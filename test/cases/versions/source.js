import { hello as hello1 } from "local:hello/hello@1.0.0"
import { hello as hello2 } from "local:hello/hello@2.0.0"

export const hello1export = {
    hello: function(name) {
        return hello1(name)
    }
}

export const hello2export = {
    hello: function(name) {
        return hello2(name)
    }
}

export { hello1export as 'local:hello/hello@1.0.0', hello2export as 'local:hello/hello@2.0.0' }