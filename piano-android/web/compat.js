/* Runtime compatibility for older Android WebView; no network polyfill loading. */
(function () {
  'use strict';
  function method(object, key, value) {
    if (!object[key]) Object.defineProperty(object, key, {value:value, configurable:true, writable:true});
  }
  method(Object, 'hasOwn', function (object, key) {return Object.prototype.hasOwnProperty.call(object, key);});
  method(Object, 'fromEntries', function (entries) {
    var result={};
    Array.from(entries).forEach(function (pair) {Object.defineProperty(result,pair[0],{value:pair[1],writable:true,enumerable:true,configurable:true});});
    return result;
  });
  method(Array.prototype, 'at', function (index) {
    var n=Number(index)||0;n=n<0?Math.ceil(n):Math.floor(n);
    return this[n<0?this.length+n:n];
  });
  method(Array.prototype, 'flat', function (depth) {
    var result=[],d=depth===undefined?1:Number(depth)||0;
    function append(array, remaining) {
      for(var i=0;i<array.length;i++)if(i in array){var value=array[i];if(remaining>0&&Array.isArray(value))append(value,remaining-1);else result.push(value);}
    }
    append(this,d);return result;
  });
  method(Array.prototype, 'flatMap', function (mapper, receiver) {return this.map(mapper,receiver).flat();});
  function detectFlexGap() {
    var box=document.createElement('div');box.style.cssText='position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px';
    for(var i=0;i<2;i++){var child=document.createElement('div');child.style.height='1px';box.appendChild(child);}
    document.body.appendChild(box);if(box.scrollHeight!==3)document.body.classList.add('legacy-flex-gap');box.parentNode.removeChild(box);
  }
  if(document.body)detectFlexGap();else document.addEventListener('DOMContentLoaded',detectFlexGap);
})();
