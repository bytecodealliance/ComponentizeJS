import { hello as hello1 } from "local:hello/hello@1.0.0"
import { hello as hello2 } from "local:hello/hello@2.0.0"

export const hello_1_0_0 = {
    hello: function(name) {
        return hello1(name)
    }
}

export const hello_2_0_0 = {
    hello: function(name) {
        return hello2(name)
    }
}
