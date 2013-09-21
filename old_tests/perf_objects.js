
function makestring(len) {
    var s = '';
    while (len--) s = s+'1';
    var b = new Buffer(s)
    return b;
}

var s = '';
var arr = new Array(1000000);
for (var i=0; i<1000000; i++) {
    s = makestring(1000);
    arr.push(s);
    if (i%1000 == 0) {
        console.log(i+' - '+s);
    }
}
