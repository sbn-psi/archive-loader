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