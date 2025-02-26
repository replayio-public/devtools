import { captureException } from "@sentry/browser";
import ErrorStackParser from "error-stack-parser";
import React, { CSSProperties, Component, PropsWithChildren, ReactNode } from "react";

import { recordData } from "replay-next/src/utils/telemetry";
import { CommandErrorArgs, isCommandError } from "shared/utils/error";

import styles from "./ErrorBoundary.module.css";

type ErrorBoundaryState = {
  error: unknown | null;
  erroredOnResetKey: string | number | undefined | null;
};

type ErrorBoundaryProps = PropsWithChildren<{
  fallback?: ReactNode;
  fallbackClassName?: string;

  name: string;

  onError?: (error: unknown) => void;

  // If `resetKey` changes after the ErrorBoundary caught an error, it will reset its state.
  // Use `resetKey` instead of `key` if you don't want the child components to be recreated
  // (and hence lose their state) every time the key changes.
  resetKey?: string | number;
}>;

type ParsedStackFrame = {
  columnNumber: number | undefined;
  fileName: string | undefined;
  lineNumber: number | undefined;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, erroredOnResetKey: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error, erroredOnResetKey: null };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    if (state.error) {
      if (state.erroredOnResetKey === null) {
        // we just caught the error and need to save the current resetKey
        return { erroredOnResetKey: props.resetKey };
      } else if (props.resetKey !== state.erroredOnResetKey) {
        // the resetKey changed after an error was caught so we need to reset the state
        return { error: null, erroredOnResetKey: null };
      }
    }

    return null;
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const { name } = this.props;

    console.error(error);

    let callStack: ParsedStackFrame[] | undefined = undefined;
    let commandErrorArgs: CommandErrorArgs | undefined = undefined;
    let errorMessage: string | undefined = undefined;
    let errorName: string | undefined = undefined;

    // Any type of value can be thrown in JavaScript.
    if (error instanceof Error) {
      errorMessage = error.message;
      errorName = error.name;

      if (isCommandError(error)) {
        commandErrorArgs = error.args;
      }

      try {
        callStack = ErrorStackParser.parse(error).map(frame => ({
          columnNumber: frame.columnNumber,
          fileName: frame.fileName,
          lineNumber: frame.lineNumber,
        }));
      } catch (error) {}
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    let componentStack: ParsedStackFrame[] | undefined = undefined;
    try {
      componentStack = ErrorStackParser.parse({
        message: "",
        name: "",
        stack: info.componentStack,
      })
        .filter(frame => {
          // Filter DOM elements from the stack trace.
          return frame.fileName !== undefined;
        })
        .map(frame => ({
          columnNumber: frame.columnNumber,
          fileName: frame.fileName,
          lineNumber: frame.lineNumber,
        }));
    } catch (error) {}

    recordData("component-error-boundary", {
      boundary: name,
      error: {
        name: errorName,
        message: errorMessage,
        callStack,
        componentStack,
      },
      command: commandErrorArgs,
    });

    captureException(error);
  }

  render() {
    const { children, fallback, fallbackClassName = "" } = this.props;
    const { error } = this.state;

    if (error !== null) {
      return fallback !== undefined ? fallback : <DefaultFallback className={fallbackClassName} />;
    }

    return children;
  }
}

export function DefaultFallback({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`${styles.Error} ${className || ""}`} style={style}>
      <svg className={styles.Logo} fill="currentColor" viewBox="0 0 34 40">
        <path d="M15.2233 8.58217L8.95319 4.91069L2.68305 1.23921C2.41111 1.08012 2.10269 0.9964 1.78875 0.99646C1.47482 0.99652 1.16642 1.08036 0.894545 1.23955C0.622668 1.39875 0.396884 1.6277 0.239864 1.90341C0.0828448 2.17911 0.000118376 2.49187 0 2.81026V17.496C0.000105567 17.8144 0.0828232 18.1272 0.239837 18.4029C0.396852 18.6786 0.622634 18.9076 0.894513 19.0668C1.16639 19.226 1.47479 19.3098 1.78874 19.3099C2.10268 19.31 2.41111 19.2262 2.68305 19.0671L8.95319 15.3957L15.2233 11.7243C15.4952 11.5651 15.721 11.336 15.878 11.0603C16.035 10.7845 16.1177 10.4717 16.1177 10.1532C16.1177 9.83477 16.035 9.52193 15.878 9.24616C15.721 8.97038 15.4952 8.74138 15.2233 8.58217V8.58217Z"></path>
        <path d="M15.2233 29.0322L8.95319 25.3608L2.68305 21.6893C2.41111 21.5302 2.10268 21.4465 1.78873 21.4465C1.47479 21.4466 1.16639 21.5304 0.894513 21.6896C0.622634 21.8488 0.396847 22.0778 0.239833 22.3535C0.0828188 22.6292 0.000105567 22.942 0 23.2604V37.9461C0.000105567 38.2645 0.0828188 38.5773 0.239833 38.853C0.396847 39.1287 0.622634 39.3577 0.894513 39.5169C1.16639 39.6761 1.47479 39.7599 1.78873 39.76C2.10268 39.76 2.41111 39.6763 2.68305 39.5172L8.95319 35.8458L15.2233 32.1743C15.4952 32.0151 15.721 31.7861 15.878 31.5103C16.035 31.2346 16.1177 30.9217 16.1177 30.6033C16.1177 30.2848 16.035 29.9719 15.878 29.6962C15.721 29.4204 15.4952 29.1914 15.2233 29.0322Z"></path>
        <path d="M33.1056 18.809L26.8355 15.1375L20.5654 11.4661C20.2935 11.307 19.985 11.2233 19.6711 11.2233C19.3572 11.2234 19.0488 11.3072 18.7769 11.4664C18.505 11.6256 18.2792 11.8546 18.1222 12.1303C17.9652 12.406 17.8825 12.7187 17.8823 13.0371V27.7229C17.8825 28.0413 17.9652 28.354 18.1222 28.6297C18.2792 28.9055 18.505 29.1344 18.7769 29.2936C19.0488 29.4528 19.3572 29.5366 19.6711 29.5367C19.985 29.5367 20.2935 29.453 20.5654 29.2939L26.8355 25.6225L33.1056 21.9511C33.3775 21.7918 33.6033 21.5628 33.7603 21.2871C33.9173 21.0113 34 20.6985 34 20.38C34 20.0616 33.9173 19.7487 33.7603 19.473C33.6033 19.1972 33.3775 18.9682 33.1056 18.809V18.809Z"></path>
      </svg>
      <div className={styles.Header}>Our apologies!</div>
      <div className={styles.Message}>
        <p>Something went wrong while replaying.</p>
        <p>We'll look into it as soon as possible.</p>
      </div>
    </div>
  );
}
