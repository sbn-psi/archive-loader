if (!Array.prototype.last) {
    Array.prototype.last = function(){
        return this[this.length - 1];
    };
}
if (!Array.prototype.first) {
    Array.prototype.first = function(){
        return this[0];
    };
}
if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function(search, replacement) {
        var target = this;
        return target.split(search).join(replacement);
    };
}

if (!Array.prototype.isEmpty) {
    Array.prototype.isEmpty = function() {
        for(var val of this) {
            if(val && val.length > 0)
                return false;
        }
        return true;
    }
}

if (!Promise.allSettled) {
    Promise.allSettled = promises =>
        Promise.all(
            promises.map((promise, i) =>
                promise
                    .then(value => ({
                        status: "fulfilled",
                        value,
                    }))
                    .catch(reason => ({
                        status: "rejected",
                        reason,
                    }))
            )
        );
}