var Fiber = require('fibers'),
	Future = require('fibers/future'),
	wait = Future.wait;

// This function returns a future which resolves after an async function. This
// demonstrates manually resolving futures.
function sleep(ms) {
    var future = new Future;
    setTimeout(function() {
        console.log(2);
        future.return();
    }, ms);
    return future;
}

Fiber(function() {
	console.log(1);
	sleep(2000).wait();
	console.log(3);
}).run();

// the above prints:
// 1
// 2
// 3