import { now } from 'wasi:clocks/wall-clock@0.2.3';
import { getRandomBytes } from 'wasi:random/random@0.2.3';

let result;
export const run = {
    run() {
        result = `NOW: ${now().seconds}, RANDOM: ${getRandomBytes(2n)}`;
    }
};

export const getResult = () => result;