export const e1 = {
    X: class {
        constructor(value) {
            this.value = value
        }
    },
    
    a: function(f) {
        return [f.x]
    }
}

export const e2 = {
    a: function(f, g) {
        return [f.x, g.x]
    }
}
