import {
  Body,
  ErrorBoundary,
  FileRoutes,
  Head,
  Html,
  Link,
  Meta,
  Routes,
  Scripts,
  Title,
} from "solid-start";
import UserStoreContext from "./components/contexts/UserStoreContext";
import "./root.css";

export default function Root() {
  const theme = (() => {
    if (typeof localStorage !== "undefined" && localStorage.getItem("theme")) {
      return localStorage.getItem("theme");
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  })();

  if (theme === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").then(
      function (registration) {
        console.log(
          "Service Worker registered with scope:",
          registration.scope,
        );
      },
      function (error) {
        console.log("Service Worker registration failed:", error);
      },
    );
  });

  return (
    <Html lang="en">
      <Head>
        <Title>Arguflow Chat</Title>
        <Meta charset="utf-8" />
        <Meta name="viewport" content="width=device-width, initial-scale=1" />
        <Link rel="manifest" href="/manifest.json" />
        <script async={false} src="/sw.js" />
        <Meta name="theme-color" content="#5E5E5E" />
        <script
          defer
          data-domain="chat.arguflow.ai"
          src="https://perhaps.arguflow.com/js/script.js"
        />

        <Meta
          name="description"
          content="Demo of Arguflow's LLM-chat infrastructure - Your Chat"
        />

        <Meta property="og:url" content="https://arguflow.ai/" />
        <Meta property="og:type" content="website/" />
        <Meta property="og:title" content="Arguflow Chat" />
        <Meta
          property="og:description"
          content="Demo of Arguflow's LLM-chat infrastructure - Your Chat"
        />
        <Meta
          property="og:image"
          content="https://blog.arguflow.ai/arguflow-og.png"
        />

        <Meta name="twitter:card" content="summary_large_image" />
        <Meta property="twitter:domain" content="chat.arguflow.ai" />
        <Meta property="twitter:url" content="https://chat.arguflow.ai" />
        <Meta name="twitter:title" content="Arguflow Chat" />
        <Meta
          name="twitter:description"
          content="Demo of Arguflow's LLM-chat infrastructure - Your Chat"
        />
        <Meta
          name="twitter:image"
          content="https://blog.arguflow.ai/arguflow-og.png"
        />
      </Head>
      <Body>
        <ErrorBoundary>
          <UserStoreContext>
            <Routes>
              <FileRoutes />
            </Routes>
          </UserStoreContext>
        </ErrorBoundary>
        <Scripts />
      </Body>
    </Html>
  );
}
