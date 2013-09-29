var obj = {
    foo: 'bar',
    'werwerwer0': '23423432423',
    'werwerwer1': '23423432423',
    'werwerwer2': '23423432423',
    'werwerwer3': '23423432423',
    'werwerwer4': '23423432423',
    'werwerwer5': '23423432423',
    'werwerwer6': '23423432423',
    'werwerwer7': '23423432423',
    'werwerwe': {
        info: {
            hash0: '12324j32h34h4kj23h4jk23h4kj23h4kj23h4jk2h34jk23h42hk4j23h4234h3223',
            hash1: '12324j32h34h4kj23h4jk23h4kj23h4kj23h4jk2h34jk23h42hk4j23h4234h3223',
            hash2: '12324j32h34h4kj23h4jk23h4kj23h4kj23h4jk2h34jk23h42hk4j23h4234h3223',
            hash3: '12324j32h34h4kj23h4jk23h4kj23h4kj23h4jk2h34jk23h42hk4j23h4234h3223',
            hash4: '12324j32h34h4kj23h4jk23h4kj23h4kj23h4jk2h34jk23h42hk4j23h4234h3223',
            hash5: '12324j32h34h4kj23h4jk23h4kj23h4kj23h4jk2h34jk23h42hk4j23h4234h3223',
            hash6: '12324j32h34h4kj23h4jk23h4kj23h4kj23h4jk2h34jk23h42hk4j23h4234h3223',
            hash7: '12324j32h34h4kj23h4jk23h4kj23h4kj23h4jk2h34jk23h42hk4j23h4234h3223',
        },
        'wewrwerwerwe': 'werweeerwerwe',
    }
}

console.time('test');

var b = new Buffer(JSON.stringify(obj));

for (var i=0; i<1000000; i++) {

    var o = JSON.parse(b.toString());
}
console.timeEnd('test');

// enc+dec: 19347ms / 1000000
// dec: 7100ms /1000000
