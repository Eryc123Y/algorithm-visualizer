/**
 * The page algoviz_show opens in an MCP Apps host: an <algo-player> that
 * takes its document from the tool result, follows the host's theme, and
 * tells the model which frame the user is looking at.
 */
import '@algoviz/elements/define';
import type { AlgoPlayer } from '@algoviz/elements';
import { App, type McpUiHostContext } from '@modelcontextprotocol/ext-apps';

interface Shown {
  readonly document: {
    readonly title?: string;
    readonly steps: readonly { readonly meta?: { narration?: string } }[];
  };
  readonly frame: number;
}

const player = document.querySelector<AlgoPlayer>('algo-player')!;
const status = document.querySelector<HTMLElement>('#status')!;

const isShown = (value: unknown): value is Shown =>
  typeof value === 'object' &&
  value !== null &&
  'document' in value &&
  'frame' in value;

function say(text: string, error = false): void {
  status.textContent = text;
  status.hidden = text === '';
  status.setAttribute('role', error ? 'alert' : 'status');
}

const app = new App({ name: 'algoviz player', version: '0.0.0' });
let shown: Shown | null = null;

function applyContext(context: McpUiHostContext | undefined): void {
  if (context?.theme !== undefined) player.theme = context.theme;
}

app.ontoolresult = (result) => {
  if (result.isError === true) {
    const [first] = result.content ?? [];
    say(first?.type === 'text' ? first.text : 'The document is invalid.', true);
    return;
  }
  if (!isShown(result.structuredContent)) {
    say('The tool result has no document to show.', true);
    return;
  }
  shown = result.structuredContent;
  say('');
  player.hidden = false;
  player.visualization = shown.document;
  player.frame = shown.frame;
};

app.onhostcontextchanged = applyContext;

// Keep the model's view of the conversation in step with the user's: the
// frame on screen and its narration, once the user stops on it.
let pending: ReturnType<typeof setTimeout> | undefined;
player.addEventListener('algo-frame', (event) => {
  clearTimeout(pending);
  const { index, length, playing } = event.detail;
  if (playing || shown === null) return;
  const doc = shown.document;
  pending = setTimeout(() => {
    const narration =
      index === 0
        ? 'the initial state'
        : (doc.steps[index - 1]?.meta?.narration ?? '(no narration)');
    const title = doc.title === undefined ? '' : ` of "${doc.title}"`;
    void app
      .updateModelContext({
        content: [
          {
            type: 'text',
            text: `The user is looking at frame ${index} of ${length}${title}: ${narration}`,
          },
        ],
      })
      .catch(() => undefined);
  }, 400);
});

say('Waiting for the visualization…');
await app.connect();
applyContext(app.getHostContext());
