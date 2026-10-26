/**
 * A minimal MCP Apps host for the E2E tests, run in the browser: it puts a
 * view's HTML in a sandboxed iframe, speaks the MCP Apps protocol to it
 * through AppBridge, and records what the view sends back. The test drives
 * it through `window.host`.
 */
import {
  AppBridge,
  PostMessageTransport,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps/app-bridge';

export interface TestHost {
  /** Loads a view and waits until it has initialized. */
  open(html: string, context: McpUiHostContext): Promise<void>;
  sendToolInput(args: Record<string, unknown>): Promise<void>;
  sendToolResult(result: Record<string, unknown>): Promise<void>;
  setTheme(theme: 'light' | 'dark'): Promise<void>;
  /** Text of every model context update the view sent, oldest first. */
  readonly contexts: string[];
  /** Heights the view asked for, oldest first. */
  readonly heights: number[];
}

let bridge: AppBridge | null = null;

const host: TestHost = {
  contexts: [],
  heights: [],
  async open(html, context) {
    const iframe = document.createElement('iframe');
    iframe.title = 'MCP App';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.cssText = 'width: 640px; height: 200px; border: 0';
    document.body.append(iframe);
    bridge = new AppBridge(
      null,
      { name: 'test host', version: '0.0.0' },
      { updateModelContext: { text: {} } },
      { hostContext: context },
    );
    bridge.onupdatemodelcontext = ({ content }) => {
      for (const block of content ?? [])
        if (block.type === 'text') host.contexts.push(block.text);
      return Promise.resolve({});
    };
    bridge.onsizechange = ({ height }) => {
      if (height === undefined) return;
      host.heights.push(height);
      iframe.style.height = `${height}px`;
    };
    const initialized = new Promise<void>((resolve) => {
      bridge!.oninitialized = () => resolve();
    });
    await bridge.connect(
      new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!),
    );
    iframe.srcdoc = html;
    await initialized;
  },
  sendToolInput: (args) => bridge!.sendToolInput({ arguments: args }),
  sendToolResult: (result) =>
    bridge!.sendToolResult(
      result as Parameters<AppBridge['sendToolResult']>[0],
    ),
  setTheme: async (theme) => {
    await bridge!.sendHostContextChange({ theme });
  },
};

(window as unknown as { host: TestHost }).host = host;
