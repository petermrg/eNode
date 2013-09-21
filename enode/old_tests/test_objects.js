var ob = function() {
    this.a = 1; // this is like a constructor
}
ob.b = 2; // this is like a "static property"
ob.prototype.c = 3; // also acts as a constructor

console.log(ob.a); // undefined
console.log(ob.b); // 2
console.log(ob.c); // undefined

ob1 = new ob(); // create an instance
console.log(ob1.a); // 1
console.log(ob1.b); // undefined
console.log(ob1.c); // 3


