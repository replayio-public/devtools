import { useAuth0 } from "@auth0/auth0-react";
import { Store } from "@reduxjs/toolkit";
import type { AppContext, AppProps } from "next/app";
import NextApp from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { ReactNode, memo, useEffect, useState } from "react";
import { Provider } from "react-redux";
import "../src/global-css";
import "../src/test-prep";

import { SystemProvider } from "design";
import DecoratedErrorBoundary from "replay-next/components/ErrorBoundary";
import { recordData as recordTelemetryData } from "replay-next/src/utils/telemetry";
import { setUnexpectedError } from "ui/actions/errors";
import { ApolloWrapper } from "ui/components/ApolloWrapper";
import _App from "ui/components/App";
import MaintenanceModeScreen from "ui/components/MaintenanceMode";
import { ConfirmProvider } from "ui/components/shared/Confirm";
import ErrorRenderer from "ui/components/shared/Error";
import LoadingScreen from "ui/components/shared/LoadingScreen";
import useAuthTelemetry from "ui/hooks/useAuthTelemetry";
import { getUnexpectedError } from "ui/reducers/app";
import { bootstrapApp } from "ui/setup";
import { useAppDispatch, useAppSelector } from "ui/setup/hooks";
import { useLaunchDarkly } from "ui/utils/launchdarkly";
import { InstallRouteListener } from "ui/utils/routeListener";
import tokenManager from "ui/utils/tokenManager";

import "../src/base.css";

interface AuthProps {
  apiKey?: string;
}

// We need to ensure that we always pass the same handleAuthError function
// to ApolloWrapper, otherwise it will create a new apolloClient every time
// and parts of the UI will reset (https://github.com/RecordReplay/devtools/issues/6168).
// But handleAuthError needs access to the current values from useAuth0(),
// so we use a constant wrapper around the _handleAuthError() function that
// will be recreated with the current values.
let _handleAuthError: () => Promise<void>;
function handleAuthError() {
  _handleAuthError?.();
}

function AppUtilities({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  _handleAuthError = async () => {
    // This handler attempts to handle the scenario in which the frontend and
    // our auth client think the user has a valid auth session but the backend
    // disagrees. In this case, we should refresh the token so we can continue
    // or, if that fails, return to the login page so the user can resume.
    if (!isAuthenticated || router.pathname.startsWith("/login")) {
      return;
    }

    try {
      recordTelemetryData("devtools-auth-error-refresh");
      await getAccessTokenSilently({ ignoreCache: true });
    } catch {
      recordTelemetryData("devtools-auth-error-refresh-fail");
      const returnToPath = window.location.pathname + window.location.search;
      router.push({ pathname: "/login", query: { returnTo: returnToPath } });
    }
  };

  return (
    <ApolloWrapper onAuthError={handleAuthError}>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ApolloWrapper>
  );
}
function Routing({ Component, pageProps }: AppProps) {
  const [store, setStore] = useState<Store | null>(null);
  const { getFeatureFlag } = useLaunchDarkly();

  useEffect(() => {
    bootstrapApp().then((store: Store) => setStore(store));
  }, []);

  if (!store) {
    // We hide the tips here since we don't have the store ready yet, which
    // the tips need to work properly.
    return null;
  }

  if (getFeatureFlag("maintenance-mode")) {
    return <MaintenanceModeScreen />;
  }

  return (
    <Provider store={store}>
      <MemoizedHeader />
      <ErrorBoundary>
        <_App>
          <InstallRouteListener />
          <React.Suspense fallback={<LoadingScreen message="Fetching data..." />}>
            <Component {...pageProps} />
          </React.Suspense>
        </_App>
      </ErrorBoundary>
    </Provider>
  );
}

// Ensure this component only renders once even if the parent component re-renders
// Otherwise it can temporarily override titles set by child components,
// causing the document title to flicker.
const MemoizedHeader = memo(function MemoizedHeader() {
  return (
    <Head>
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <link rel="icon" type="image/svg+xml" href="/images/favicon.svg" />
      <title>Replay</title>
    </Head>
  );
});

const App = ({ apiKey, ...props }: AppProps & AuthProps) => {
  useAuthTelemetry();
  const router = useRouter();
  let head: React.ReactNode;

  // HACK: Coordinates with the recording page to render its <head> contents for
  // social meta tags. This can be removed once we are able to handle SSP
  // properly all the way to the pages. __N_SSP is a very private
  // (https://github.com/vercel/next.js/discussions/12558) Next.js prop to
  // indicate server-side rendering. It works for now but likely will be removed
  // or replaced so we need to fix our SSR and stop using it.
  if (props.__N_SSP && router.pathname.match(/^\/recording\//)) {
    head = <props.Component {...props.pageProps} headOnly />;
  }
  return (
    <SystemProvider>
      <tokenManager.Auth0Provider apiKey={apiKey}>
        {head}
        <AppUtilities>
          <Routing {...props} />
        </AppUtilities>
      </tokenManager.Auth0Provider>
    </SystemProvider>
  );
};

App.getInitialProps = (appContext: AppContext) => {
  const props = NextApp.getInitialProps(appContext);
  const authHeader = appContext.ctx.req?.headers.authorization;
  const authProps: AuthProps = { apiKey: undefined };

  if (authHeader) {
    const [scheme, token] = authHeader.split(" ", 2);
    if (!token || !/^Bearer$/i.test(scheme)) {
      console.error("Format is Authorization: Bearer [token]");
    } else {
      authProps.apiKey = token;
    }
  }

  return { ...props, ...authProps };
};

function ErrorBoundary({ children }: { children: ReactNode }) {
  const unexpectedError = useAppSelector(getUnexpectedError);
  const dispatch = useAppDispatch();

  const onError = (error: unknown) => {
    if (error instanceof Error && error.name === "ChunkLoadError") {
      return dispatch(setUnexpectedError({
        message: "Replay updated",
        content: "Replay was updated since you opened it. Please refresh the page.",
        action: "refresh",
      }, true));
    }

    // Otherwise, if it's bubbled up this far, React is crashing anyway.
    // Let's show the "Oops!" screen and tell the user to refresh.

    dispatch(
      setUnexpectedError({
        message: "Unexpected error",
        content: "Something went wrong, but you can refresh the page to try again.",
        action: "refresh",
      })
    );
  };

  return (
    <DecoratedErrorBoundary onError={onError} fallback={<ErrorRenderer />} name="Routing">
      {unexpectedError ? <ErrorRenderer /> : children}
    </DecoratedErrorBoundary>
  );
}

export default App;