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
if (!Object.prototype.isEmpty) {
    Object.prototype.isEmpty = function() {
        for(var key in this) {
            if(this.hasOwnProperty(key) && !key.startsWith('$$'))
                return false;
        }
        return true;
    }
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