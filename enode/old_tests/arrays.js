var a = {};

var i = 0;

//var s = '';
while (true) {
    //s = ((i>>24)&0xff) + '.' + ((i>>16)&0xff) + '.' + ((i>>8)&0xff) + '.' + ((i)&0xff);
    a[i.toString(16)] = i;
    i++;
    if (i%1000000 == 0) console.log((i / 1000000)+'M');
}

process.exit();
///

var a = [];

var i = 0;

while (true) {
    a[i] = i;
    i++;
    if (i%1000 == 0) console.log((i / 1000)+'k');
}
