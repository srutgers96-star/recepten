import { render } from 'preact';
import './styles.css';
import { App } from './app';
import { registerServiceWorker } from './pwa';

export interface StartOptions {
  /** A share token was present in the URL hash at boot: open the import preview first. */
  openImportFromHash: boolean;
}

export function start(opts: StartOptions) {
  registerServiceWorker();
  render(<App openImportFromHash={opts.openImportFromHash} />, document.getElementById('app')!);
}
