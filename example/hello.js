import { getAnswer } from "external"

export function hello (name) {
  const answer = getAnswer()
  return `Hello ${name} the answer is ${answer}`
}
