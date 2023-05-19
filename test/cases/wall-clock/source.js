import { now } from 'wall-clock-t';

export function test () {
  return `NOW: ${now().seconds}`;
}
