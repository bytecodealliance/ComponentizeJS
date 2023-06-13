import { now } from 'local:wall-clock/wall-clock-t';

export function test () {
  return `NOW: ${now().seconds}`;
}
