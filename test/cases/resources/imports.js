export class Y {
    constructor (value) {
        this.a = value
    }
    getA () {
        return this.a;
    }
    setA (a) {
        this.a = a;
    }
    static add (x, a) {
        x.setA(x.getA() + a);
        return x;
    }
}
