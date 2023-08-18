import { Accessor, For, Show, createEffect, createSignal } from "solid-js";
import {
  FiArrowDown,
  FiRefreshCcw,
  FiSend,
  FiStopCircle,
} from "solid-icons/fi";
import { FaSolidScaleUnbalanced } from "solid-icons/fa";
import { RiOthersBoxingLine } from "solid-icons/ri";
import {
  isMessageArray,
  messageRoleFromIndex,
  type Message,
} from "~/types/messages";
import { Topic } from "~/types/topics";
import {
  Menu,
  MenuItem,
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "solid-headless";
import { AfMessage } from "../Atoms/AfMessage";
import { IoFunnelOutline, IoOptions } from "solid-icons/io";

export interface LayoutProps {
  selectedTopic: Accessor<Topic | undefined>;
}

const scrollToBottomOfMessages = () => {
  // const element = document.getElementById("topic-messages");
  // if (!element) {
  //   console.error("Could not find element with id 'topic-messages'");
  //   return;
  // }
  // element.scrollIntoView({ block: "end" });
};

const Layout = (props: LayoutProps) => {
  const api_host = import.meta.env.VITE_API_HOST as unknown as string;

  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    setNewMessageContent(textarea.value);
  };

  const [loadingMessages, setLoadingMessages] = createSignal<boolean>(true);
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [newMessageContent, setNewMessageContent] = createSignal<string>("");
  const [atMessageBottom, setAtMessageBottom] = createSignal<boolean>(true);
  const [streamingCompletion, setStreamingCompletion] =
    createSignal<boolean>(false);
  const [completionAbortController, setCompletionAbortController] =
    createSignal<AbortController>(new AbortController());
  const [disableAutoScroll, setDisableAutoScroll] =
    createSignal<boolean>(false);
  const [triggerScrollToBottom, setTriggerScrollToBottom] =
    createSignal<boolean>(false);

  createEffect(() => {
    const element = document.getElementById("topic-layout");
    if (!element) {
      console.error("Could not find element with id 'topic-messages'");
      return;
    }

    setAtMessageBottom(
      element.scrollHeight - element.scrollTop === element.clientHeight,
    );

    element.addEventListener("scroll", () => {
      setAtMessageBottom(
        element.scrollHeight - element.scrollTop === element.clientHeight,
      );
    });

    return () => {
      element.removeEventListener("scroll", () => {
        setAtMessageBottom(
          element.scrollHeight - element.scrollTop === element.clientHeight,
        );
      });
    };
  });

  createEffect(() => {
    window.addEventListener("wheel", (event) => {
      const delta = Math.sign(event.deltaY);
      7;

      if (delta === -1) {
        setDisableAutoScroll(true);
      }
    });
  });

  createEffect(() => {
    const triggerScrollToBottomVal = triggerScrollToBottom();
    const disableAutoScrollVal = disableAutoScroll();
    if (triggerScrollToBottomVal && !disableAutoScrollVal) {
      scrollToBottomOfMessages();
      setTriggerScrollToBottom(false);
    }
  });

  const handleReader = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ) => {
    let done = false;
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      if (doneReading) {
        done = doneReading;
        setStreamingCompletion(false);
      }
      if (value) {
        const decoder = new TextDecoder();
        const chunk = decoder.decode(value);

        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          const newMessage = {
            content: lastMessage.content + chunk,
          };
          return [...prev.slice(0, prev.length - 1), newMessage];
        });

        setTriggerScrollToBottom(true);
      }
    }
  };

  const fetchCompletion = async ({
    new_message_content,
    topic_id,
    regenerateLastMessage,
  }: {
    new_message_content: string;
    topic_id: string;
    regenerateLastMessage?: boolean;
  }) => {
    let requestMethod = "POST";

    if (regenerateLastMessage) {
      requestMethod = "DELETE";
      setMessages((prev) => {
        const newMessages = [{ content: "" }];
        return [
          ...prev.slice(0, prev.length > 3 ? prev.length - 1 : prev.length),
          ...newMessages,
        ];
      });
    } else {
      setNewMessageContent("");
      const newMessageTextarea = document.getElementById(
        "new-message-content-textarea",
      ) as HTMLTextAreaElement;
      resizeTextarea(newMessageTextarea);

      setMessages((prev) => {
        const newMessages = [{ content: new_message_content }, { content: "" }];
        if (prev.length === 0) {
          newMessages.unshift(...[{ content: "" }, { content: "" }]);
        }
        return [...prev, ...newMessages];
      });
    }

    try {
      const res = await fetch(`${api_host}/message`, {
        method: requestMethod,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          new_message_content,
          topic_id,
        }),
        signal: completionAbortController().signal,
      });
      // get the response as a stream
      const reader = res.body?.getReader();
      if (!reader) {
        return;
      }
      setStreamingCompletion(true);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = await handleReader(reader);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (
    topicId: string | undefined,
    abortController: AbortController,
  ) => {
    setLoadingMessages(true);
    if (!topicId) {
      return;
    }
    const res = await fetch(`${api_host}/messages/${topicId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      signal: abortController.signal,
    });
    const data: unknown = await res.json();
    if (data && isMessageArray(data)) {
      setMessages(data);
    }
    setLoadingMessages(false);
    scrollToBottomOfMessages();
  };

  createEffect(() => {
    setMessages([]);
    const fetchMessagesAbortController = new AbortController();
    void fetchMessages(props.selectedTopic()?.id, fetchMessagesAbortController);

    return () => {
      fetchMessagesAbortController.abort();
    };
  });

  const submitNewMessage = () => {
    const topic_id = props.selectedTopic()?.id;
    if (!topic_id || !newMessageContent() || streamingCompletion()) {
      return;
    }
    void fetchCompletion({
      new_message_content: newMessageContent(),
      topic_id,
    });
  };

  return (
    <>
      <Show when={loadingMessages()}>
        <div class="flex w-full flex-col">
          <div class="flex w-full flex-col items-center justify-center">
            <img src="/cooking-crab.gif" class="aspect-square w-[128px]" />
          </div>
        </div>
      </Show>
      <Show when={!loadingMessages()}>
        <div class="relative flex flex-col justify-between">
          <div class="flex flex-col items-center pb-32" id="topic-messages">
            <For each={messages()}>
              {(message, idx) => {
                return (
                  <AfMessage
                    role={messageRoleFromIndex(idx())}
                    content={message.content}
                    onEdit={(content: string) => {
                      const newMessage: Message = {
                        content: "",
                      };
                      setMessages((prev) => {
                        return [...prev.slice(0, idx() + 1), newMessage];
                      });
                      completionAbortController().abort();
                      setCompletionAbortController(new AbortController());
                      fetch(`${api_host}/message`, {
                        method: "PUT",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        credentials: "include",
                        signal: completionAbortController().signal,
                        body: JSON.stringify({
                          new_message_content: content,
                          message_sort_order: idx() + 1,
                          topic_id: props.selectedTopic()?.id,
                        }),
                      })
                        .then((response) => {
                          if (!response.ok) {
                            return;
                          }
                          const reader = response.body?.getReader();
                          if (!reader) {
                            return;
                          }
                          setStreamingCompletion(true);
                          setDisableAutoScroll(false);
                          handleReader(reader).catch((e) => {
                            console.error("Error handling reader: ", e);
                          });
                        })
                        .catch((e) => {
                          console.error(
                            "Error fetching completion on edit message: ",
                            e,
                          );
                        });
                    }}
                  />
                );
              }}
            </For>
          </div>

          <div class="fixed bottom-0 right-0 flex w-full flex-col items-center space-y-4 bg-gradient-to-b from-transparent via-zinc-200 to-zinc-100 p-4 dark:via-zinc-800 dark:to-zinc-900 lg:w-3/4">
            <Show when={messages().length > 2}>
              <div class="flex w-full justify-center">
                <Show when={!streamingCompletion()}>
                  <button
                    classList={{
                      "flex w-fit items-center justify-center space-x-4 rounded-xl bg-neutral-50 px-4 py-2 text-sm dark:bg-neutral-700 dark:text-white":
                        true,
                      "ml-auto": !atMessageBottom(),
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      const topic_id = props.selectedTopic()?.id;
                      if (!topic_id) {
                        return;
                      }
                      void fetchCompletion({
                        new_message_content: "",
                        topic_id,
                        regenerateLastMessage: true,
                      });
                    }}
                  >
                    <FiRefreshCcw />
                    <p>Regenerate Response</p>
                  </button>
                </Show>
                <Show when={streamingCompletion()}>
                  <button
                    classList={{
                      "flex w-fit items-center justify-center space-x-4 rounded-xl bg-neutral-50 px-4 py-2 text-sm dark:bg-neutral-700 dark:text-white":
                        true,
                      "ml-auto": !atMessageBottom(),
                    }}
                    onClick={() => {
                      completionAbortController().abort();
                      setCompletionAbortController(new AbortController());
                      setStreamingCompletion(false);
                    }}
                  >
                    <FiStopCircle class="h-5 w-5" />
                    <p>Stop Generating</p>
                  </button>
                </Show>
                <Show when={!atMessageBottom()}>
                  <button
                    class="ml-auto flex w-fit items-center justify-center space-x-4 rounded-full bg-neutral-50 p-2 text-sm dark:bg-neutral-700 dark:text-white"
                    onClick={() => {
                      scrollToBottomOfMessages();
                    }}
                  >
                    <FiArrowDown class="h-5 w-5" />
                  </button>
                </Show>
              </div>
            </Show>
            <div class="flex w-full flex-row space-x-2">
              <form class="relative mr-12 flex h-fit max-h-[calc(100vh-32rem)] w-full flex-col items-center overflow-y-auto rounded-xl bg-neutral-50 py-1 pl-4 pr-6 text-neutral-800 dark:bg-neutral-700 dark:text-white">
                <textarea
                  id="new-message-content-textarea"
                  class="w-full resize-none whitespace-pre-wrap bg-transparent py-1 scrollbar-thin scrollbar-track-neutral-200 scrollbar-thumb-neutral-400 scrollbar-track-rounded-md scrollbar-thumb-rounded-md focus:outline-none dark:bg-neutral-700 dark:text-white dark:scrollbar-track-neutral-700 dark:scrollbar-thumb-neutral-600"
                  placeholder="Write your argument"
                  value={newMessageContent()}
                  disabled={streamingCompletion()}
                  onInput={(e) => resizeTextarea(e.target)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const new_message_content = newMessageContent();
                      if (!new_message_content) {
                        return;
                      }
                      const topic_id = props.selectedTopic()?.id;
                      if (!topic_id) {
                        return;
                      }
                      void fetchCompletion({
                        new_message_content,
                        topic_id,
                      });
                      return;
                    }
                  }}
                  rows="1"
                />
                <button
                  type="submit"
                  classList={{
                    "flex h-10 w-10 items-center justify-center absolute right-[0px] bottom-0":
                      true,
                    "text-neutral-400": !newMessageContent(),
                  }}
                  disabled={!newMessageContent() || streamingCompletion()}
                  onClick={(e) => {
                    e.preventDefault();
                    submitNewMessage();
                  }}
                >
                  <FiSend />
                </button>
              </form>
              <div class="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center dark:text-white">
                <Popover defaultOpen={false} class="relative flex items-center">
                  {({ isOpen }) => (
                    <>
                      <PopoverButton aria-label="Toggle theme mode">
                        <IoOptions class="h-5 w-5" />
                      </PopoverButton>
                      <Transition
                        show={isOpen()}
                        enter="transition duration-200"
                        enterFrom="opacity-0 -translate-y-1 scale-50"
                        enterTo="opacity-100 translate-y-0 scale-100"
                        leave="transition duration-150"
                        leaveFrom="opacity-100 translate-y-0 scale-100"
                        leaveTo="opacity-0 -translate-y-1 scale-50"
                      >
                        <PopoverPanel
                          unmount={true}
                          class="absolute -right-2 -top-[185px] z-50 w-fit transform"
                        >
                          <Menu class="flex flex-col space-y-1 overflow-hidden rounded-lg border border-neutral-400 bg-neutral-50 p-1 shadow-lg drop-shadow-lg dark:border-slate-900 dark:bg-neutral-700 dark:text-white">
                            <MenuItem as="button" aria-label="Empty" />
                            <MenuItem
                              as="button"
                              class="flex items-center space-x-2 rounded-md border border-neutral-200 px-2 py-1 hover:cursor-pointer focus:bg-neutral-200 focus:outline-none dark:border-neutral-600 dark:focus:bg-neutral-600"
                              onClick={() => {
                                setNewMessageContent(
                                  'You are the Debate judge who must decide a winner in the debate, reason to the best degree who won this debate, respond either "affirmative" or "negative". Then explain why.',
                                );
                              }}
                            >
                              <div>
                                <FaSolidScaleUnbalanced class="h-6 w-6" />
                              </div>
                              <div>
                                <div
                                  classList={{
                                    "text-md font-medium": true,
                                  }}
                                >
                                  Judge
                                </div>
                              </div>
                            </MenuItem>
                            <MenuItem
                              as="button"
                              class="flex items-center space-x-2 rounded-md border border-neutral-200 px-2 py-1 hover:cursor-pointer focus:bg-neutral-200 focus:outline-none dark:border-neutral-600 dark:focus:bg-neutral-600"
                            >
                              <div>
                                <RiOthersBoxingLine class="h-6 w-6" />
                              </div>
                              <div>
                                <div
                                  classList={{
                                    "text-md font-medium": true,
                                  }}
                                  onClick={() => {
                                    setNewMessageContent(
                                      "Summarize the main areas of clash that occurred in this debate",
                                    );
                                  }}
                                >
                                  Summarize Clash
                                </div>
                              </div>
                            </MenuItem>
                            <MenuItem
                              as="button"
                              class="flex items-center space-x-2 rounded-md border border-neutral-200 px-2 py-1 hover:cursor-pointer focus:bg-neutral-200 focus:outline-none dark:border-neutral-600 dark:focus:bg-neutral-600"
                            >
                              <div>
                                <IoFunnelOutline class="h-6 w-6" />
                              </div>
                              <div>
                                <div
                                  classList={{
                                    "text-md font-medium": true,
                                  }}
                                  onClick={() => {
                                    setNewMessageContent(
                                      "Summarize the themes of our debate thus far",
                                    );
                                  }}
                                >
                                  Summarize Themes
                                </div>
                              </div>
                            </MenuItem>
                          </Menu>
                        </PopoverPanel>
                      </Transition>
                    </>
                  )}
                </Popover>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};

export default Layout;
