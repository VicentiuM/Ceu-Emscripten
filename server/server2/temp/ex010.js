// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');

    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    // The path is absolute if the normalized version is the same as the resolved.
    if (!ret && filename != nodePath['resolve'](filename)) {
      filename = path.join(__dirname, '..', 'src', filename);
      ret = nodeFS['readFileSync'](filename);
    }
    if (ret && !binary) ret = ret.toString();
    return ret;
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in: 
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at: 
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      assert(args.length == sig.length-1);
      if (!args.splice) args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].apply(null, args);
    } else {
      assert(sig.length == 1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      sigCache[func] = function dynCall_wrapper() {
        return Runtime.dynCall(sig, func, arguments);
      };
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16);(assert((((STACKTOP|0) < (STACK_MAX|0))|0))|0); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + (assert(!staticSealed),size))|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + (assert(DYNAMICTOP > 0),size))|0;DYNAMICTOP = (((DYNAMICTOP)+15)&-16); if (DYNAMICTOP >= TOTAL_MEMORY) { var success = enlargeMemory(); if (!success) { DYNAMICTOP = ret;  return 0; } }; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*(+4294967296))) : ((+((low>>>0)))+((+((high|0)))*(+4294967296)))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface. 
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    assert(returnType !== 'array', 'Return type should not be "array".');
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if ((!opts || !opts.async) && typeof EmterpreterAsync === 'object') {
      assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling ccall');
    }
    if (opts && opts.async) assert(!returnType, 'async ccalls cannot return values');
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }
  
  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    funcstr += "if (typeof EmterpreterAsync === 'object') { assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling cwrap') }";
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if ((typeof _sbrk !== 'undefined' && !_sbrk.called) || !runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

function UTF8ArrayToString(u8Array, idx) {
  var u0, u1, u2, u3, u4, u5;

  var str = '';
  while (1) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    u0 = u8Array[idx++];
    if (!u0) return str;
    if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
    u1 = u8Array[idx++] & 63;
    if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
    u2 = u8Array[idx++] & 63;
    if ((u0 & 0xF0) == 0xE0) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u3 = u8Array[idx++] & 63;
      if ((u0 & 0xF8) == 0xF0) {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
      } else {
        u4 = u8Array[idx++] & 63;
        if ((u0 & 0xFC) == 0xF8) {
          u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
        } else {
          u5 = u8Array[idx++] & 63;
          u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
        }
      }
    }
    if (u0 < 0x10000) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF16ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
    if (codeUnit == 0)
      return str;
    ++i;
    // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
    str += String.fromCharCode(codeUnit);
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed, we can try ours which may return a partial result
    } catch(e) {
      // failure when using libcxxabi, we can try ours which may return a partial result
      return func;
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  return demangleAll(jsStackTrace());
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += (4096 - (x % 4096));
  }
  return x;
}

var HEAP;
var buffer;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;

var totalMemory = 64*1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  Module.printErr('increasing TOTAL_MEMORY to ' + totalMemory + ' to be compliant with the asm.js spec (and given that TOTAL_STACK=' + TOTAL_STACK + ')');
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  buffer = new ArrayBuffer(TOTAL_MEMORY);
}
updateGlobalBufferViews();


// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
if (HEAPU8[0] !== 255 || HEAPU8[3] !== 0) throw 'Typed arrays 2 must be run on a little-endian system';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))>>0)]=chr;
    i = i + 1;
  }
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[((buffer++)>>0)]=array[i];
  }
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

// === Body ===

var ASM_CONSTS = [function() { _begin() }];

function _emscripten_asm_const_v(code) {
 return ASM_CONSTS[code]();
}



STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 4192;
  /* global initializers */  __ATINIT__.push();
  

/* memory initializer */ allocate([12,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,3,0,0,0,92,12,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,95,98,101,103,105,110,40,41,0,72,101,108,108,111,32,87,111,114,108,100,33,10,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,45,43,32,32,32,48,88,48,120,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,46,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}

var EMTSTACKTOP = getMemory(1048576);
var EMT_STACK_MAX = EMTSTACKTOP + 1048576;

var eb = getMemory(36688);
assert(eb % 8 === 0);
__ATPRERUN__.push(function() {
  HEAPU8.set([140,5,136,2,0,0,0,0,2,200,0,0,76,2,0,0,2,201,0,0,0,202,154,59,2,202,0,0,11,10,0,0,1,203,0,0,143,203,134,2,136,204,0,0,0,203,204,0,143,203,135,2,136,203,0,0,1,204,112,2,3,203,203,204,137,203,0,0,130,203,0,0,136,204,0,0,49,203,203,204,88,0,0,0,135,203,0,0,141,203,135,2,1,204,24,2,3,203,203,204,25,53,203,40,141,204,135,2,3,203,204,200,143,203,57,1,141,204,135,2,1,205,64,2,3,204,204,205,25,203,204,12,143,203,227,1,141,203,135,2,3,203,203,200,25,75,203,9,1,203,0,0,143,203,254,1,1,203,0,0,143,203,48,2,1,203,0,0,143,203,52,2,0,203,1,0,143,203,81,2,1,203,255,255,141,204,254,1,15,88,203,204,121,88,21,0,2,204,0,0,255,255,255,127,141,203,254,1,4,92,204,203,141,203,48,2,15,98,92,203,121,98,8,0,134,106,0,0,220,140,0,0,1,203,75,0,85,106,203,0,1,203,255,255,143,203,255,1,119,0,10,0,141,203,48,2,141,204,254,1,3,110,203,204,0,204,110,0,143,204,255,1,119,0,4,0,141,203,254,1,0,204,203,0,143,204,255,1,141,204,81,2,78,115,204,0,41,204,115,24,42,204,204,24,32,204,204,0,121,204,10,0,141,203,255,1,0,204,203,0,143,204,0,2,141,203,52,2,0,204,203,0,143,204,53,2,1,204,244,0,143,204,134,2,119,0,42,16,0,123,115,0,141,203,81,2,0,204,203,0,143,204,83,2,41,204,123,24,42,204,204,24,1,203,0,0,1,205,38,0,138,204,203,205,28,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,24,2,0,0,56,2,0,0,119,0,17,0,141,205,83,2,0,203,205,0,143,203,86,2,141,205,83,2,0,203,205,0,143,203,119,2,119,0,17,0,141,205,83,2,0,203,205,0,143,203,87,2,141,205,83,2,0,203,205,0,143,203,120,2,1,203,9,0,143,203,134,2,119,0,8,0,141,204,83,2,25,128,204,1,78,45,128,0,0,123,45,0,0,204,128,0,143,204,83,2,119,0,190,255,141,204,134,2,32,204,204,9,121,204,38,0,1,204,0,0,143,204,134,2,141,204,87,2,25,134,204,1,78,138,134,0,41,204,138,24,42,204,204,24,32,204,204,37,120,204,8,0,141,203,87,2,0,204,203,0,143,204,86,2,141,203,120,2,0,204,203,0,143,204,119,2,119,0,22,0,141,204,120,2,25,146,204,1,141,204,87,2,25,151,204,2,78,156,151,0,41,204,156,24,42,204,204,24,32,204,204,37,121,204,8,0,0,204,151,0,143,204,87,2,0,204,146,0,143,204,120,2,1,204,9,0,143,204,134,2,119,0,225,255,0,204,151,0,143,204,86,2,0,204,146,0,143,204,119,2,119,0,1,0,141,204,119,2,0,168,204,0,141,204,81,2,0,174,204,0,1,204,0,0,46,204,0,204,88,3,0,0,82,191,0,0,38,204,191,32,32,204,204,0,121,204,6,0,141,203,81,2,4,205,168,174,134,204,0,0,204,86,0,0,203,205,0,0,141,205,119,2,141,203,81,2,13,204,205,203,143,204,3,1,141,204,3,1,120,204,16,0,141,203,52,2,0,204,203,0,143,204,54,2,141,203,255,1,0,204,203,0,143,204,254,1,4,204,168,174,143,204,48,2,141,203,86,2,0,204,203,0,143,204,81,2,141,203,54,2,0,204,203,0,143,204,52,2,119,0,67,255,141,203,86,2,25,204,203,1,143,204,7,1,141,203,7,1,78,204,203,0,143,204,14,1,141,204,14,1,41,204,204,24,42,204,204,24,26,204,204,48,35,204,204,10,121,204,52,0,141,203,86,2,25,204,203,2,143,204,19,1,141,203,19,1,78,204,203,0,143,204,23,1,141,203,86,2,25,204,203,3,143,204,31,1,141,204,23,1,41,204,204,24,42,204,204,24,32,204,204,36,141,203,31,1,141,205,7,1,125,30,204,203,205,0,0,0,141,205,23,1,41,205,205,24,42,205,205,24,32,205,205,36,1,203,1,0,141,204,52,2,125,37,205,203,204,0,0,0,141,205,23,1,41,205,205,24,42,205,205,24,32,205,205,36,121,205,7,0,141,205,14,1,41,205,205,24,42,205,205,24,26,205,205,48,0,203,205,0,119,0,3,0,1,205,255,255,0,203,205,0,0,204,203,0,143,204,41,2,78,48,30,0,0,204,48,0,143,204,40,1,141,203,41,2,0,204,203,0,143,204,251,1,0,204,37,0,143,204,55,2,0,204,30,0,143,204,105,2,119,0,12,0,141,203,14,1,0,204,203,0,143,204,40,1,1,204,255,255,143,204,251,1,141,203,52,2,0,204,203,0,143,204,55,2,141,203,7,1,0,204,203,0,143,204,105,2,141,203,40,1,41,203,203,24,42,203,203,24,0,204,203,0,143,204,34,1,141,204,34,1,38,204,204,224,32,204,204,32,121,204,83,0,141,203,34,1,0,204,203,0,143,204,70,1,141,203,40,1,0,204,203,0,143,204,93,1,1,204,0,0,143,204,20,2,141,203,105,2,0,204,203,0,143,204,108,2,141,203,70,1,26,204,203,32,143,204,64,1,1,204,1,0,141,203,64,1,22,204,204,203,2,203,0,0,137,40,1,0,19,204,204,203,32,204,204,0,121,204,11,0,141,203,93,1,0,204,203,0,143,204,140,1,141,203,20,2,0,204,203,0,143,204,21,2,141,203,108,2,0,204,203,0,143,204,107,2,119,0,59,0,141,203,93,1,41,203,203,24,42,203,203,24,0,204,203,0,143,204,90,1,1,203,1,0,141,205,90,1,26,205,205,32,22,203,203,205,141,205,20,2,20,203,203,205,0,204,203,0,143,204,107,1,141,203,108,2,25,204,203,1,143,204,113,1,141,203,113,1,78,204,203,0,143,204,122,1,141,204,122,1,41,204,204,24,42,204,204,24,38,204,204,224,32,204,204,32,121,204,16,0,141,203,122,1,41,203,203,24,42,203,203,24,0,204,203,0,143,204,70,1,141,203,122,1,0,204,203,0,143,204,93,1,141,203,107,1,0,204,203,0,143,204,20,2,141,203,113,1,0,204,203,0,143,204,108,2,119,0,196,255,141,203,122,1,0,204,203,0,143,204,140,1,141,203,107,1,0,204,203,0,143,204,21,2,141,203,113,1,0,204,203,0,143,204,107,2,119,0,9,0,141,203,40,1,0,204,203,0,143,204,140,1,1,204,0,0,143,204,21,2,141,203,105,2,0,204,203,0,143,204,107,2,141,203,140,1,41,203,203,24,42,203,203,24,32,204,203,42,143,204,146,1,141,204,146,1,121,204,158,0,141,203,107,2,25,204,203,1,143,204,151,1,141,203,151,1,78,204,203,0,143,204,157,1,141,204,157,1,41,204,204,24,42,204,204,24,26,204,204,48,35,204,204,10,121,204,50,0,141,203,107,2,25,204,203,2,143,204,167,1,141,203,167,1,78,204,203,0,143,204,173,1,141,204,173,1,41,204,204,24,42,204,204,24,32,204,204,36,121,204,36,0,141,204,157,1,41,204,204,24,42,204,204,24,26,204,204,48,41,204,204,2,1,203,10,0,97,4,204,203,141,204,151,1,78,203,204,0,143,203,194,1,141,204,194,1,41,204,204,24,42,204,204,24,26,204,204,48,41,204,204,3,3,203,3,204,143,203,216,1,141,204,216,1,82,203,204,0,143,203,223,1,141,204,216,1,106,203,204,4,143,203,224,1,141,204,107,2,25,203,204,3,143,203,225,1,1,203,1,0,143,203,56,2,141,204,225,1,0,203,204,0,143,203,106,2,141,204,223,1,0,203,204,0,143,203,112,2,119,0,6,0,1,203,24,0,143,203,134,2,119,0,3,0,1,203,24,0,143,203,134,2,141,203,134,2,32,203,203,24,121,203,52,0,1,203,0,0,143,203,134,2,141,204,55,2,32,203,204,0,143,203,226,1,141,203,226,1,120,203,3,0,1,7,255,255,119,0,151,14,1,203,0,0,53,203,0,203,224,7,0,0,141,204,21,2,0,203,204,0,143,203,22,2,1,203,0,0,143,203,57,2,141,204,151,1,0,203,204,0,143,203,88,2,1,203,0,0,143,203,113,2,119,0,136,0,82,203,2,0,143,203,249,1,141,204,249,1,1,205,0,0,25,205,205,4,26,205,205,1,3,204,204,205,1,205,0,0,25,205,205,4,26,205,205,1,40,205,205,255,19,204,204,205,0,203,204,0,143,203,228,1,141,204,228,1,82,203,204,0,143,203,229,1,141,203,228,1,25,203,203,4,85,2,203,0,1,203,0,0,143,203,56,2,141,204,151,1,0,203,204,0,143,203,106,2,141,204,229,1,0,203,204,0,143,203,112,2,141,204,112,2,34,203,204,0,143,203,230,1,141,203,230,1,121,203,23,0,141,204,21,2,1,205,0,32,20,204,204,205,0,203,204,0,143,203,231,1,1,204,0,0,141,205,112,2,4,203,204,205,143,203,232,1,141,205,231,1,0,203,205,0,143,203,22,2,141,205,56,2,0,203,205,0,143,203,57,2,141,205,106,2,0,203,205,0,143,203,88,2,141,205,232,1,0,203,205,0,143,203,113,2,119,0,81,0,141,205,21,2,0,203,205,0,143,203,22,2,141,205,56,2,0,203,205,0,143,203,57,2,141,205,106,2,0,203,205,0,143,203,88,2,141,205,112,2,0,203,205,0,143,203,113,2,119,0,68,0,141,205,140,1,41,205,205,24,42,205,205,24,0,203,205,0,143,203,233,1,141,203,233,1,26,203,203,48,35,203,203,10,121,203,48,0,141,203,107,2,0,55,203,0,1,203,0,0,143,203,31,2,141,205,233,1,26,203,205,48,143,203,42,2,141,205,31,2,27,203,205,10,143,203,234,1,141,205,234,1,141,204,42,2,3,203,205,204,143,203,235,1,25,54,55,1,78,56,54,0,41,203,56,24,42,203,203,24,26,203,203,48,35,203,203,10,121,203,10,0,0,55,54,0,141,204,235,1,0,203,204,0,143,203,31,2,41,204,56,24,42,204,204,24,26,203,204,48,143,203,42,2,119,0,234,255,141,203,235,1,34,203,203,0,121,203,3,0,1,7,255,255,119,0,25,14,141,204,21,2,0,203,204,0,143,203,22,2,141,204,55,2,0,203,204,0,143,203,57,2,0,203,54,0,143,203,88,2,141,204,235,1,0,203,204,0,143,203,113,2,119,0,12,0,141,204,21,2,0,203,204,0,143,203,22,2,141,204,55,2,0,203,204,0,143,203,57,2,141,204,107,2,0,203,204,0,143,203,88,2,1,203,0,0,143,203,113,2,141,203,88,2,78,57,203,0,41,203,57,24,42,203,203,24,32,203,203,46,121,203,120,0,141,203,88,2,25,58,203,1,78,59,58,0,41,203,59,24,42,203,203,24,32,203,203,42,120,203,43,0,41,203,59,24,42,203,203,24,26,203,203,48,35,203,203,10,121,203,9,0,0,76,58,0,1,203,0,0,143,203,32,2,41,204,59,24,42,204,204,24,26,203,204,48,143,203,43,2,119,0,6,0,1,203,0,0,143,203,59,2,0,203,58,0,143,203,89,2,119,0,100,0,141,203,32,2,27,72,203,10,141,203,43,2,3,73,72,203,25,74,76,1,78,77,74,0,41,203,77,24,42,203,203,24,26,203,203,48,35,203,203,10,121,203,9,0,0,76,74,0,0,203,73,0,143,203,32,2,41,204,77,24,42,204,204,24,26,203,204,48,143,203,43,2,119,0,238,255,0,203,73,0,143,203,59,2,0,203,74,0,143,203,89,2,119,0,76,0,141,203,88,2,25,60,203,2,78,61,60,0,41,203,61,24,42,203,203,24,26,203,203,48,35,203,203,10,121,203,29,0,141,203,88,2,25,62,203,3,78,63,62,0,41,203,63,24,42,203,203,24,32,203,203,36,121,203,22,0,41,203,61,24,42,203,203,24,26,203,203,48,41,203,203,2,1,204,10,0,97,4,203,204,78,64,60,0,41,204,64,24,42,204,204,24,26,204,204,48,41,204,204,3,3,65,3,204,82,66,65,0,106,67,65,4,141,204,88,2,25,68,204,4,0,204,66,0,143,204,59,2,0,204,68,0,143,204,89,2,119,0,40,0,141,204,57,2,32,69,204,0,120,69,3,0,1,7,255,255,119,0,162,13,1,204,0,0,46,204,0,204,220,11,0,0,82,204,2,0,143,204,250,1,141,204,250,1,1,203,0,0,25,203,203,4,26,203,203,1,3,204,204,203,1,203,0,0,25,203,203,4,26,203,203,1,40,203,203,255,19,204,204,203,0,70,204,0,82,71,70,0,25,204,70,4,85,2,204,0,0,204,71,0,143,204,59,2,0,204,60,0,143,204,89,2,119,0,11,0,1,204,0,0,143,204,59,2,0,204,60,0,143,204,89,2,119,0,6,0,1,204,255,255,143,204,59,2,141,203,88,2,0,204,203,0,143,204,89,2,141,203,89,2,0,204,203,0,143,204,90,2,1,204,0,0,143,204,103,2,141,204,90,2,78,78,204,0,1,204,57,0,41,203,78,24,42,203,203,24,26,203,203,65,48,204,204,203,64,12,0,0,1,7,255,255,119,0,113,13,141,204,90,2,25,79,204,1,1,204,147,0,141,203,103,2,27,203,203,58,3,204,204,203,41,203,78,24,42,203,203,24,26,203,203,65,3,80,204,203,78,81,80,0,1,203,255,0,19,203,81,203,26,203,203,1,35,203,203,8,121,203,8,0,0,203,79,0,143,203,90,2,1,204,255,0,19,204,81,204,0,203,204,0,143,203,103,2,119,0,224,255,141,204,90,2,0,203,204,0,143,203,91,2,141,204,103,2,0,203,204,0,143,203,104,2,119,0,1,0,41,203,81,24,42,203,203,24,32,203,203,0,121,203,3,0,1,7,255,255,119,0,77,13,1,203,255,255,141,204,251,1,15,82,203,204,41,204,81,24,42,204,204,24,32,204,204,19,121,204,7,0,121,82,3,0,1,7,255,255,119,0,67,13,1,204,52,0,143,204,134,2,119,0,31,0,121,82,19,0,141,204,251,1,41,204,204,2,3,83,4,204,1,204,255,0,19,204,81,204,85,83,204,0,141,204,251,1,41,204,204,3,3,84,3,204,82,85,84,0,106,86,84,4,141,204,135,2,85,204,85,0,141,204,135,2,109,204,4,86,1,204,52,0,143,204,134,2,119,0,12,0,1,204,0,0,53,204,0,204,100,13,0,0,1,7,0,0,119,0,40,13,141,203,135,2,1,205,255,0,19,205,81,205,134,204,0,0,88,67,0,0,203,205,2,0,141,204,134,2,32,204,204,52,121,204,17,0,1,204,0,0,143,204,134,2,1,204,0,0,53,204,0,204,200,13,0,0,141,205,255,1,0,204,205,0,143,204,254,1,4,204,168,174,143,204,48,2,141,205,57,2,0,204,205,0,143,204,52,2,0,204,79,0,143,204,81,2,119,0,188,252,141,204,91,2,78,87,204,0,141,203,104,2,33,203,203,0,41,206,87,24,42,206,206,24,38,206,206,15,32,206,206,3,19,203,203,206,121,203,6,0,41,203,87,24,42,203,203,24,38,203,203,223,0,205,203,0,119,0,4,0,41,203,87,24,42,203,203,24,0,205,203,0,0,204,205,0,143,204,109,2,141,204,22,2,1,205,0,32,19,204,204,205,0,89,204,0,141,204,22,2,2,205,0,0,255,255,254,255,19,204,204,205,0,90,204,0,32,205,89,0,141,203,22,2,125,204,205,203,90,0,0,0,143,204,23,2,141,204,109,2,1,206,65,0,1,207,56,0,138,204,206,207,128,15,0,0,64,15,0,0,132,15,0,0,64,15,0,0,220,15,0,0,224,15,0,0,228,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,232,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,80,16,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,64,15,0,0,84,16,0,0,64,15,0,0,88,16,0,0,192,16,0,0,168,17,0,0,248,52,0,0,252,52,0,0,64,15,0,0,0,53,0,0,64,15,0,0,64,15,0,0,64,15,0,0,4,53,0,0,48,53,0,0,116,55,0,0,188,56,0,0,64,15,0,0,64,15,0,0,4,57,0,0,64,15,0,0,52,57,0,0,64,15,0,0,64,15,0,0,104,57,0,0,141,207,81,2,0,206,207,0,143,206,240,1,141,207,23,2,0,206,207,0,143,206,26,2,141,207,59,2,0,206,207,0,143,206,66,2,1,206,0,0,143,206,71,2,1,206,115,2,143,206,76,2,0,206,53,0,143,206,124,2,119,0,135,10,119,0,138,0,141,206,135,2,82,167,206,0,141,206,135,2,106,169,206,4,141,206,135,2,109,206,8,167,141,206,135,2,25,206,206,8,1,205,0,0,109,206,4,205,141,205,135,2,141,206,135,2,25,206,206,8,85,205,206,0,141,205,135,2,25,206,205,8,143,206,222,1,1,206,255,255,143,206,65,2,1,206,86,0,143,206,134,2,119,0,112,10,119,0,115,0,119,0,114,0,119,0,113,0,141,206,135,2,82,49,206,0,141,206,59,2,32,170,206,0,121,170,14,0,1,205,32,0,141,203,113,2,1,207,0,0,141,208,23,2,134,206,0,0,216,95,0,0,0,205,203,207,208,0,0,0,1,206,0,0,143,206,28,2,1,206,97,0,143,206,134,2,119,0,91,10,0,206,49,0,143,206,222,1,141,208,59,2,0,206,208,0,143,206,65,2,1,206,86,0,143,206,134,2,119,0,83,10,119,0,70,10,119,0,85,0,141,206,135,2,82,157,206,0,141,206,135,2,106,158,206,4,141,206,135,2,1,205,24,2,3,206,206,205,1,205,255,0,19,205,157,205,107,206,39,205,141,206,135,2,1,203,24,2,3,206,206,203,25,205,206,39,143,205,240,1,0,205,90,0,143,205,26,2,1,205,1,0,143,205,66,2,1,205,0,0,143,205,71,2,1,205,115,2,143,205,76,2,0,205,53,0,143,205,124,2,119,0,55,10,141,205,135,2,82,139,205,0,141,205,135,2,106,140,205,4,34,205,140,0,121,205,21,0,1,205,0,0,1,203,0,0,134,141,0,0,188,141,0,0,205,203,139,140,128,203,0,0,0,142,203,0,141,203,135,2,85,203,141,0,141,203,135,2,109,203,4,142,0,143,141,0,0,144,142,0,1,203,1,0,143,203,67,2,1,203,115,2,143,203,72,2,1,203,76,0,143,203,134,2,119,0,29,10,141,203,23,2,1,205,0,8,19,203,203,205,32,203,203,0,121,203,19,0,141,203,23,2,38,203,203,1,32,203,203,0,1,205,115,2,1,206,117,2,125,5,203,205,206,0,0,0,0,143,139,0,0,144,140,0,141,205,23,2,38,205,205,1,0,206,205,0,143,206,67,2,0,206,5,0,143,206,72,2,1,206,76,0,143,206,134,2,119,0,6,10,0,143,139,0,0,144,140,0,1,206,1,0,143,206,67,2,1,206,116,2,143,206,72,2,1,206,76,0,143,206,134,2,119,0,253,9,141,206,135,2,86,189,206,0,141,206,135,2,1,208,0,0,109,206,16,208,127,208,0,0,87,208,189,0,127,208,0,0,82,190,208,0,127,208,0,0,106,192,208,4,34,208,192,0,121,208,7,0,68,13,189,0,1,208,1,0,143,208,68,2,1,208,232,9,143,208,74,2,119,0,26,0,141,208,23,2,1,206,0,8,19,208,208,206,32,208,208,0,121,208,16,0,141,208,23,2,38,208,208,1,32,208,208,0,1,206,233,9,1,207,238,9,125,6,208,206,207,0,0,0,58,13,189,0,141,206,23,2,38,206,206,1,0,207,206,0,143,207,68,2,0,207,6,0,143,207,74,2,119,0,6,0,58,13,189,0,1,207,1,0,143,207,68,2,1,207,235,9,143,207,74,2,127,207,0,0,87,207,13,0,127,207,0,0,82,193,207,0,127,207,0,0,106,194,207,4,2,207,0,0,0,0,240,127,19,207,194,207,2,206,0,0,0,0,240,127,16,207,207,206,2,206,0,0,0,0,240,127,19,206,194,206,2,208,0,0,0,0,240,127,13,206,206,208,1,208,0,0,34,208,208,0,19,206,206,208,20,207,207,206,121,207,46,8,141,206,135,2,25,206,206,16,134,207,0,0,104,142,0,0,13,206,0,0,144,207,4,1,142,207,4,1,59,206,2,0,65,207,207,206,59,206,0,0,70,207,207,206,121,207,8,0,141,206,135,2,106,207,206,16,143,207,5,1,141,207,135,2,141,206,5,1,26,206,206,1,109,207,16,206,141,206,109,2,39,206,206,32,32,206,206,97,121,206,119,1,141,207,74,2,25,206,207,9,143,206,6,1,141,207,109,2,38,207,207,32,32,207,207,0,141,208,74,2,141,203,6,1,125,206,207,208,203,0,0,0,143,206,73,2,141,203,68,2,39,203,203,2,0,206,203,0,143,206,8,1,1,203,11,0,141,208,59,2,16,206,203,208,143,206,9,1,1,208,12,0,141,203,59,2,4,206,208,203,143,206,10,1,141,206,9,1,141,203,10,1,32,203,203,0,20,206,206,203,121,206,5,0,142,206,4,1,59,203,2,0,65,14,206,203,119,0,49,0,141,206,10,1,0,203,206,0,143,203,78,2,59,203,8,0,144,203,79,2,141,206,78,2,26,203,206,1,143,203,11,1,142,206,79,2,59,208,16,0,65,203,206,208,144,203,12,1,141,203,11,1,32,203,203,0,120,203,8,0,141,208,11,1,0,203,208,0,143,203,78,2,142,208,12,1,58,203,208,0,144,203,79,2,119,0,240,255,141,208,73,2,78,203,208,0,143,203,13,1,141,203,13,1,41,203,203,24,42,203,203,24,32,203,203,45,121,203,11,0,142,203,12,1,142,208,4,1,59,206,2,0,65,208,208,206,68,208,208,0,142,206,12,1,64,208,208,206,63,203,203,208,68,14,203,0,119,0,9,0,142,203,4,1,59,208,2,0,65,203,203,208,142,208,12,1,63,203,203,208,142,208,12,1,64,14,203,208,119,0,1,0,141,203,135,2,106,208,203,16,143,208,15,1,141,206,15,1,34,206,206,0,121,206,6,0,1,206,0,0,141,207,15,1,4,206,206,207,0,203,206,0,119,0,3,0,141,206,15,1,0,203,206,0,0,208,203,0,143,208,16,1,141,203,16,1,141,206,16,1,34,206,206,0,41,206,206,31,42,206,206,31,141,207,135,2,1,205,64,2,3,207,207,205,25,207,207,12,134,208,0,0,116,94,0,0,203,206,207,0,143,208,17,1,141,208,17,1,141,207,135,2,1,206,64,2,3,207,207,206,25,207,207,12,45,208,208,207,8,21,0,0,141,208,135,2,1,207,64,2,3,208,208,207,1,207,48,0,107,208,11,207,141,208,135,2,1,206,64,2,3,208,208,206,25,207,208,11,143,207,16,2,119,0,4,0,141,208,17,1,0,207,208,0,143,207,16,2,141,208,16,2,26,207,208,1,143,207,18,1,141,207,18,1,141,208,15,1,42,208,208,31,38,208,208,2,25,208,208,43,1,206,255,0,19,208,208,206,83,207,208,0,141,207,16,2,26,208,207,2,143,208,20,1,141,208,20,1,141,207,109,2,25,207,207,15,1,206,255,0,19,207,207,206,83,208,207,0,141,208,59,2,34,207,208,1,143,207,58,2,58,16,14,0,141,208,135,2,3,207,208,200,143,207,82,2,75,207,16,0,143,207,21,1,1,208,99,2,141,206,21,1,90,207,208,206,143,207,22,1,141,208,82,2,25,207,208,1,143,207,24,1,141,207,82,2,141,208,22,1,1,206,255,0,19,208,208,206,141,206,109,2,38,206,206,32,20,208,208,206,1,206,255,0,19,208,208,206,83,207,208,0,141,207,21,1,76,207,207,0,64,208,16,207,144,208,25,1,141,208,24,1,141,207,57,1,4,208,208,207,32,208,208,1,121,208,27,0,141,208,23,2,38,208,208,8,32,208,208,0,141,207,58,2,142,206,25,1,59,203,16,0,65,206,206,203,59,203,0,0,69,206,206,203,19,207,207,206,19,208,208,207,121,208,5,0,141,207,24,1,0,208,207,0,143,208,84,2,119,0,14,0,141,207,82,2,25,208,207,2,143,208,26,1,141,208,24,1,1,207,46,0,83,208,207,0,141,208,26,1,0,207,208,0,143,207,84,2,119,0,4,0,141,208,24,1,0,207,208,0,143,207,84,2,142,207,25,1,59,208,16,0,65,207,207,208,59,208,0,0,70,207,207,208,121,207,8,0,142,207,25,1,59,208,16,0,65,16,207,208,141,207,84,2,0,208,207,0,143,208,82,2,119,0,187,255,141,207,84,2,0,208,207,0,143,208,85,2,119,0,1,0,141,207,59,2,33,208,207,0,143,208,27,1,1,207,254,255,141,206,57,1,4,207,207,206,141,206,85,2,3,207,207,206,141,206,59,2,15,208,207,206,143,208,28,1,141,206,227,1,25,206,206,2,141,207,59,2,3,208,206,207,143,208,29,1,141,206,27,1,141,203,28,1,19,206,206,203,121,206,6,0,141,206,29,1,141,203,20,1,4,206,206,203,0,207,206,0,119,0,9,0,141,206,227,1,141,203,57,1,4,206,206,203,141,203,20,1,4,206,206,203,141,203,85,2,3,206,206,203,0,207,206,0,0,208,207,0,143,208,49,2,1,207,32,0,141,206,113,2,141,203,49,2,141,205,8,1,3,203,203,205,141,205,23,2,134,208,0,0,216,95,0,0,0,207,206,203,205,0,0,0,82,208,0,0,143,208,30,1,141,208,30,1,38,208,208,32,32,208,208,0,121,208,6,0,141,205,73,2,141,203,8,1,134,208,0,0,204,86,0,0,205,203,0,0,1,203,48,0,141,205,113,2,141,206,49,2,141,207,8,1,3,206,206,207,141,207,23,2,2,209,0,0,0,0,1,0,21,207,207,209,134,208,0,0,216,95,0,0,0,203,205,206,207,0,0,0,82,208,0,0,143,208,32,1,141,208,32,1,38,208,208,32,32,208,208,0,121,208,9,0,141,207,135,2,3,207,207,200,141,206,85,2,141,205,57,1,4,206,206,205,134,208,0,0,204,86,0,0,207,206,0,0,1,206,48,0,141,207,49,2,141,205,85,2,141,203,57,1,4,205,205,203,141,203,227,1,141,209,20,1,4,203,203,209,3,205,205,203,4,207,207,205,1,205,0,0,1,203,0,0,134,208,0,0,216,95,0,0,0,206,207,205,203,0,0,0,82,208,0,0,143,208,33,1,141,208,33,1,38,208,208,32,32,208,208,0,121,208,8,0,141,203,20,1,141,205,227,1,141,207,20,1,4,205,205,207,134,208,0,0,204,86,0,0,203,205,0,0,1,205,32,0,141,203,113,2,141,207,49,2,141,206,8,1,3,207,207,206,141,206,23,2,1,209,0,32,21,206,206,209,134,208,0,0,216,95,0,0,0,205,203,207,206,0,0,0,141,206,49,2,141,207,8,1,3,206,206,207,141,207,113,2,15,208,206,207,143,208,35,1,141,206,35,1,121,206,4,0,141,206,113,2,0,207,206,0,119,0,5,0,141,206,49,2,141,203,8,1,3,206,206,203,0,207,206,0,0,208,207,0,143,208,111,2,141,208,111,2,0,8,208,0,119,0,250,6,141,207,59,2,34,208,207,0,143,208,36,1,141,208,36,1,1,207,6,0,141,206,59,2,125,41,208,207,206,0,0,0,142,206,4,1,59,207,2,0,65,206,206,207,59,207,0,0,70,206,206,207,121,206,18,0,141,207,135,2,106,206,207,16,143,206,37,1,141,206,135,2,141,207,37,1,26,207,207,28,109,206,16,207,142,207,4,1,59,206,2,0,65,207,207,206,60,206,0,0,0,0,0,16,65,23,207,206,141,207,37,1,26,206,207,28,143,206,38,1,119,0,8,0,141,206,135,2,106,50,206,16,142,206,4,1,59,207,2,0,65,23,206,207,0,207,50,0,143,207,38,1,141,206,38,1,34,207,206,0,143,207,39,1,141,206,39,1,121,206,5,0,141,206,135,2,25,206,206,24,0,207,206,0,119,0,6,0,141,206,135,2,25,206,206,24,1,208,32,1,3,206,206,208,0,207,206,0,0,25,207,0,58,27,23,0,0,207,25,0,143,207,118,2,75,207,27,0,143,207,41,1,141,207,118,2,141,206,41,1,85,207,206,0,141,207,118,2,25,206,207,4,143,206,42,1,141,207,41,1,77,207,207,0,64,206,27,207,144,206,43,1,142,206,43,1,60,207,0,0,0,202,154,59,65,206,206,207,59,207,0,0,70,206,206,207,121,206,9,0,142,206,43,1,60,207,0,0,0,202,154,59,65,27,206,207,141,206,42,1,0,207,206,0,143,207,118,2,119,0,230,255,141,207,135,2,106,43,207,16,1,207,0,0,47,207,207,43,16,29,0,0,0,207,43,0,143,207,44,1,0,207,25,0,143,207,239,1,141,206,42,1,0,207,206,0,143,207,123,2,1,206,29,0,141,208,44,1,15,207,206,208,143,207,45,1,141,208,45,1,1,206,29,0,141,203,44,1,125,207,208,206,203,0,0,0,143,207,46,1,141,203,123,2,26,207,203,4,143,207,2,2,141,203,2,2,141,206,239,1,16,207,203,206,143,207,47,1,141,207,47,1,121,207,5,0,141,206,239,1,0,207,206,0,143,207,241,1,119,0,84,0,1,207,0,0,143,207,252,1,141,206,2,2,0,207,206,0,143,207,3,2,141,206,3,2,82,207,206,0,143,207,48,1,141,206,48,1,1,203,0,0,141,208,46,1,135,207,1,0,206,203,208,0,143,207,49,1,128,208,0,0,0,207,208,0,143,207,50,1,141,208,49,1,141,203,50,1,141,206,252,1,1,205,0,0,134,207,0,0,52,142,0,0,208,203,206,205,143,207,51,1,128,205,0,0,0,207,205,0,143,207,52,1,141,205,51,1,141,206,52,1,1,203,0,0,134,207,0,0,124,139,0,0,205,206,201,203,143,207,53,1,128,203,0,0,0,207,203,0,143,207,54,1,141,207,3,2,141,203,53,1,85,207,203,0,141,207,51,1,141,206,52,1,1,205,0,0,134,203,0,0,20,142,0,0,207,206,201,205,143,203,55,1,128,205,0,0,0,203,205,0,143,203,56,1,141,205,3,2,26,203,205,4,143,203,1,2,141,205,1,2,141,206,239,1,16,203,205,206,143,203,58,1,141,203,58,1,120,203,8,0,141,206,55,1,0,203,206,0,143,203,252,1,141,206,1,2,0,203,206,0,143,203,3,2,119,0,195,255,141,203,55,1,32,203,203,0,121,203,5,0,141,206,239,1,0,203,206,0,143,203,241,1,119,0,10,0,141,206,239,1,26,203,206,4,143,203,59,1,141,203,59,1,141,206,55,1,85,203,206,0,141,203,59,1,0,206,203,0,143,206,241,1,141,203,123,2,0,206,203,0,143,206,125,2,141,203,241,1,141,205,125,2,16,206,203,205,143,206,60,1,141,206,60,1,120,206,5,0,141,205,125,2,0,206,205,0,143,206,126,2,119,0,18,0,141,205,125,2,26,206,205,4,143,206,61,1,141,205,61,1,82,206,205,0,143,206,62,1,141,206,62,1,32,206,206,0,121,206,5,0,141,205,61,1,0,206,205,0,143,206,125,2,119,0,234,255,141,205,125,2,0,206,205,0,143,206,126,2,119,0,1,0,141,205,135,2,106,206,205,16,143,206,63,1,141,206,135,2,141,205,63,1,141,203,46,1,4,205,205,203,109,206,16,205,1,205,0,0,141,206,63,1,141,203,46,1,4,206,206,203,47,205,205,206,232,28,0,0,141,206,63,1,141,203,46,1,4,205,206,203,143,205,44,1,141,203,241,1,0,205,203,0,143,205,239,1,141,203,126,2,0,205,203,0,143,205,123,2,119,0,96,255,141,205,63,1,141,203,46,1,4,44,205,203,141,205,241,1,0,203,205,0,143,203,238,1,141,205,126,2,0,203,205,0,143,203,122,2,119,0,7,0,0,44,43,0,0,203,25,0,143,203,238,1,141,205,42,1,0,203,205,0,143,203,122,2,34,203,44,0,143,203,65,1,141,203,65,1,121,203,175,0,0,203,44,0,143,203,67,1,141,205,238,1,0,203,205,0,143,203,243,1,141,205,122,2,0,203,205,0,143,203,128,2,1,205,0,0,141,206,67,1,4,203,205,206,143,203,66,1,1,206,9,0,141,205,66,1,15,206,206,205,1,205,9,0,141,207,66,1,125,203,206,205,207,0,0,0,143,203,68,1,141,207,243,1,141,205,128,2,16,203,207,205,143,203,69,1,141,203,69,1,121,203,75,0,1,203,0,0,143,203,253,1,141,205,243,1,0,203,205,0,143,203,4,2,141,205,4,2,82,203,205,0,143,203,73,1,141,205,73,1,141,207,68,1,24,205,205,207,141,207,253,1,3,203,205,207,143,203,74,1,141,203,4,2,141,207,74,1,85,203,207,0,141,203,73,1,1,205,1,0,141,206,68,1,22,205,205,206,26,205,205,1,19,203,203,205,141,205,68,1,24,205,201,205,5,207,203,205,143,207,75,1,141,205,4,2,25,207,205,4,143,207,76,1,141,205,76,1,141,203,128,2,16,207,205,203,143,207,77,1,141,207,77,1,121,207,8,0,141,203,75,1,0,207,203,0,143,207,253,1,141,203,76,1,0,207,203,0,143,207,4,2,119,0,219,255,141,203,243,1,82,207,203,0,143,207,78,1,141,203,243,1,25,207,203,4,143,207,79,1,141,207,78,1,32,207,207,0,141,203,79,1,141,205,243,1,125,33,207,203,205,0,0,0,141,205,75,1,32,205,205,0,121,205,6,0,0,35,33,0,141,203,128,2,0,205,203,0,143,205,129,2,119,0,28,0,141,203,128,2,25,205,203,4,143,205,80,1,141,205,128,2,141,203,75,1,85,205,203,0,0,35,33,0,141,205,80,1,0,203,205,0,143,203,129,2,119,0,17,0,141,205,243,1,82,203,205,0,143,203,71,1,141,205,243,1,25,203,205,4,143,203,72,1,141,203,71,1,32,203,203,0,141,205,72,1,141,207,243,1,125,34,203,205,207,0,0,0,0,35,34,0,141,205,128,2,0,207,205,0,143,207,129,2,141,205,109,2,39,205,205,32,32,205,205,102,125,207,205,25,35,0,0,0,143,207,81,1,141,205,129,2,0,207,205,0,143,207,82,1,25,205,41,25,28,205,205,9,38,205,205,255,25,205,205,1,141,203,82,1,141,206,81,1,4,203,203,206,42,203,203,2,47,205,205,203,120,31,0,0,141,205,81,1,25,203,41,25,28,203,203,9,38,203,203,255,25,203,203,1,41,203,203,2,3,205,205,203,0,207,205,0,119,0,3,0,141,205,129,2,0,207,205,0,0,52,207,0,141,205,135,2,106,207,205,16,143,207,83,1,141,207,135,2,141,205,83,1,141,203,68,1,3,205,205,203,109,207,16,205,141,205,83,1,141,207,68,1,3,205,205,207,34,205,205,0,121,205,10,0,141,207,83,1,141,203,68,1,3,205,207,203,143,205,67,1,0,205,35,0,143,205,243,1,0,205,52,0,143,205,128,2,119,0,96,255,0,205,35,0,143,205,242,1,0,205,52,0,143,205,127,2,119,0,7,0,141,203,238,1,0,205,203,0,143,205,242,1,141,203,122,2,0,205,203,0,143,205,127,2,141,203,242,1,141,207,127,2,16,205,203,207,143,205,84,1,141,205,84,1,121,205,44,0,141,207,242,1,0,205,207,0,143,205,85,1,141,207,242,1,82,205,207,0,143,205,86,1,141,205,86,1,35,205,205,10,121,205,7,0,141,207,85,1,4,207,25,207,42,207,207,2,27,205,207,9,143,205,12,2,119,0,31,0,141,207,85,1,4,207,25,207,42,207,207,2,27,205,207,9,143,205,11,2,1,205,10,0,143,205,30,2,141,207,30,2,27,205,207,10,143,205,87,1,141,207,11,2,25,205,207,1,143,205,88,1,141,205,86,1,141,207,87,1,48,205,205,207,176,32,0,0,141,207,88,1,0,205,207,0,143,205,12,2,119,0,10,0,141,207,88,1,0,205,207,0,143,205,11,2,141,207,87,1,0,205,207,0,143,205,30,2,119,0,236,255,1,205,0,0,143,205,12,2,141,207,109,2,39,207,207,32,33,207,207,102,141,203,12,2,1,206,0,0,125,205,207,203,206,0,0,0,143,205,89,1,141,206,89,1,4,206,41,206,33,203,41,0,141,207,109,2,39,207,207,32,32,207,207,103,19,203,203,207,41,203,203,31,42,203,203,31,3,205,206,203,143,205,91,1,141,203,127,2,0,205,203,0,143,205,92,1,141,205,91,1,141,203,92,1,4,203,203,25,42,203,203,2,27,203,203,9,26,203,203,9,47,205,205,203,148,38,0,0,25,203,25,4,141,206,91,1,1,207,0,36,3,206,206,207,28,206,206,9,38,206,206,255,1,207,0,4,4,206,206,207,41,206,206,2,3,205,203,206,143,205,94,1,141,205,91,1,1,206,0,36,3,205,205,206,30,205,205,9,38,205,205,255,25,205,205,1,34,205,205,9,121,205,30,0,1,205,10,0,143,205,35,2,141,206,91,1,1,203,0,36,3,206,206,203,30,206,206,9,38,206,206,255,25,205,206,1,143,205,45,2,141,206,35,2,27,205,206,10,143,205,95,1,141,206,45,2,25,205,206,1,143,205,44,2,141,205,44,2,32,205,205,9,121,205,5,0,141,206,95,1,0,205,206,0,143,205,33,2,119,0,10,0,141,206,95,1,0,205,206,0,143,205,35,2,141,206,44,2,0,205,206,0,143,205,45,2,119,0,237,255,1,205,10,0,143,205,33,2,141,206,94,1,82,205,206,0,143,205,96,1,141,206,96,1,141,203,33,2,9,206,206,203,38,206,206,255,0,205,206,0,143,205,97,1,141,206,94,1,25,206,206,4,141,203,127,2,13,205,206,203,143,205,98,1,141,205,98,1,141,203,97,1,32,203,203,0,19,205,205,203,121,205,11,0,141,203,242,1,0,205,203,0,143,205,247,1,141,203,94,1,0,205,203,0,143,205,7,2,141,203,12,2,0,205,203,0,143,205,14,2,119,0,239,0,141,203,96,1,141,206,33,2,7,203,203,206,38,203,203,255,0,205,203,0,143,205,99,1,141,203,99,1,38,203,203,1,32,203,203,0,121,203,5,0,61,203,0,0,0,0,0,90,58,205,203,0,119,0,5,0,62,203,0,0,1,0,0,0,0,0,64,67,58,205,203,0,58,17,205,0,141,203,33,2,28,203,203,2,38,203,203,255,0,205,203,0,143,205,100,1,141,205,97,1,141,203,100,1,48,205,205,203,8,35,0,0,61,205,0,0,0,0,0,63,144,205,101,2,119,0,16,0,141,203,98,1,141,206,97,1,141,207,100,1,13,206,206,207,19,203,203,206,121,203,4,0,59,203,1,0,58,205,203,0,119,0,4,0,61,203,0,0,0,0,192,63,58,205,203,0,58,26,205,0,58,205,26,0,144,205,101,2,141,203,68,2,32,205,203,0,143,205,101,1,141,205,101,1,121,205,7,0,58,205,17,0,144,205,80,2,142,203,101,2,58,205,203,0,144,205,102,2,119,0,23,0,141,203,74,2,78,205,203,0,143,205,102,1,141,205,102,1,41,205,205,24,42,205,205,24,32,205,205,45,120,205,7,0,58,205,17,0,144,205,80,2,142,203,101,2,58,205,203,0,144,205,102,2,119,0,9,0,142,203,101,2,68,205,203,0,144,205,103,1,68,205,17,0,144,205,80,2,142,203,103,1,58,205,203,0,144,205,102,2,141,205,94,1,141,203,96,1,141,206,97,1,4,203,203,206,85,205,203,0,142,205,80,2,142,206,102,2,63,203,205,206,144,203,104,1,142,206,104,1,142,205,80,2,70,203,206,205,143,203,105,1,141,203,105,1,120,203,11,0,141,205,242,1,0,203,205,0,143,203,247,1,141,205,94,1,0,203,205,0,143,203,7,2,141,205,12,2,0,203,205,0,143,203,14,2,119,0,134,0,141,205,96,1,141,206,97,1,4,205,205,206,141,206,33,2,3,203,205,206,143,203,106,1,141,203,94,1,141,206,106,1,85,203,206,0,2,206,0,0,255,201,154,59,141,203,106,1,48,206,206,203,76,37,0,0,141,203,242,1,0,206,203,0,143,206,245,1,141,203,94,1,0,206,203,0,143,206,6,2,141,203,6,2,26,206,203,4,143,206,108,1,141,206,6,2,1,203,0,0,85,206,203,0,141,206,108,1,141,205,245,1,16,203,206,205,143,203,109,1,141,203,109,1,121,203,11,0,141,205,245,1,26,203,205,4,143,203,110,1,141,203,110,1,1,205,0,0,85,203,205,0,141,203,110,1,0,205,203,0,143,205,246,1,119,0,4,0,141,203,245,1,0,205,203,0,143,205,246,1,141,203,108,1,82,205,203,0,143,205,111,1,141,205,108,1,141,203,111,1,25,203,203,1,85,205,203,0,2,203,0,0,255,201,154,59,141,205,111,1,25,205,205,1,48,203,203,205,48,37,0,0,141,205,246,1,0,203,205,0,143,203,245,1,141,205,108,1,0,203,205,0,143,203,6,2,119,0,212,255,141,205,246,1,0,203,205,0,143,203,244,1,141,205,108,1,0,203,205,0,143,203,5,2,119,0,7,0,141,205,242,1,0,203,205,0,143,203,244,1,141,205,94,1,0,203,205,0,143,203,5,2,141,205,244,1,0,203,205,0,143,203,112,1,141,205,244,1,82,203,205,0,143,203,114,1,141,203,114,1,35,203,203,10,121,203,13,0,141,205,244,1,0,203,205,0,143,203,247,1,141,205,5,2,0,203,205,0,143,203,7,2,141,205,112,1,4,205,25,205,42,205,205,2,27,203,205,9,143,203,14,2,119,0,35,0,141,205,112,1,4,205,25,205,42,205,205,2,27,203,205,9,143,203,13,2,1,203,10,0,143,203,36,2,141,205,36,2,27,203,205,10,143,203,115,1,141,205,13,2,25,203,205,1,143,203,116,1,141,203,114,1,141,205,115,1,48,203,203,205,36,38,0,0,141,205,244,1,0,203,205,0,143,203,247,1,141,205,5,2,0,203,205,0,143,203,7,2,141,205,116,1,0,203,205,0,143,203,14,2,119,0,8,0,141,205,116,1,0,203,205,0,143,203,13,2,141,205,115,1,0,203,205,0,143,203,36,2,119,0,230,255,141,205,7,2,25,203,205,4,143,203,117,1,141,205,117,1,141,206,127,2,16,203,205,206,143,203,118,1,141,203,118,1,141,206,117,1,141,205,127,2,125,51,203,206,205,0,0,0,141,206,247,1,0,205,206,0,143,205,248,1,141,206,14,2,0,205,206,0,143,205,15,2,0,205,51,0,143,205,133,2,119,0,10,0,141,206,242,1,0,205,206,0,143,205,248,1,141,206,12,2,0,205,206,0,143,205,15,2,141,206,127,2,0,205,206,0,143,205,133,2,1,206,0,0,141,203,15,2,4,205,206,203,143,205,119,1,141,203,133,2,0,205,203,0,143,205,131,2,141,203,248,1,141,206,131,2,16,205,203,206,143,205,120,1,141,205,120,1,120,205,6,0,1,38,0,0,141,206,131,2,0,205,206,0,143,205,132,2,119,0,19,0,141,206,131,2,26,205,206,4,143,205,121,1,141,206,121,1,82,205,206,0,143,205,123,1,141,205,123,1,32,205,205,0,121,205,5,0,141,206,121,1,0,205,206,0,143,205,131,2,119,0,233,255,1,38,1,0,141,206,131,2,0,205,206,0,143,205,132,2,119,0,1,0,141,205,109,2,39,205,205,32,32,205,205,103,121,205,148,0,33,205,41,0,38,205,205,1,40,205,205,1,3,39,205,41,141,206,15,2,15,205,206,39,143,205,124,1,1,206,251,255,141,203,15,2,15,205,206,203,143,205,125,1,141,205,124,1,141,203,125,1,19,205,205,203,121,205,10,0,26,203,39,1,141,206,15,2,4,205,203,206,143,205,126,1,141,205,109,2,26,11,205,1,141,205,126,1,0,20,205,0,119,0,4,0,141,205,109,2,26,11,205,2,26,20,39,1,141,205,23,2,38,205,205,8,32,205,205,0,120,205,7,0,0,15,11,0,0,24,20,0,141,205,23,2,38,205,205,8,0,47,205,0,119,0,117,0,121,38,49,0,141,206,132,2,26,205,206,4,143,205,127,1,141,206,127,1], eb + 0);
  HEAPU8.set([82,205,206,0,143,205,128,1,141,205,128,1,32,205,205,0,121,205,4,0,1,205,9,0,143,205,47,2,119,0,39,0,141,205,128,1,31,205,205,10,38,205,205,255,32,205,205,0,121,205,6,0,1,205,10,0,143,205,39,2,1,205,0,0,143,205,46,2,119,0,4,0,1,205,0,0,143,205,47,2,119,0,26,0,141,206,39,2,27,205,206,10,143,205,129,1,141,206,46,2,25,205,206,1,143,205,130,1,141,205,128,1,141,206,129,1,9,205,205,206,38,205,205,255,32,205,205,0,121,205,8,0,141,206,129,1,0,205,206,0,143,205,39,2,141,206,130,1,0,205,206,0,143,205,46,2,119,0,238,255,141,206,130,1,0,205,206,0,143,205,47,2,119,0,3,0,1,205,9,0,143,205,47,2,39,206,11,32,0,205,206,0,143,205,131,1,141,206,132,2,0,205,206,0,143,205,132,1,141,205,131,1,32,205,205,102,121,205,24,0,141,206,132,1,4,206,206,25,42,206,206,2,27,206,206,9,26,206,206,9,141,203,47,2,4,205,206,203,143,205,133,1,141,205,133,1,34,205,205,0,1,203,0,0,141,206,133,1,125,21,205,203,206,0,0,0,15,206,20,21,143,206,134,1,141,206,134,1,125,18,206,20,21,0,0,0,0,15,11,0,0,24,18,0,1,47,0,0,119,0,34,0,141,203,132,1,4,203,203,25,42,203,203,2,27,203,203,9,26,203,203,9,141,205,15,2,3,206,203,205,143,206,135,1,141,205,135,1,141,203,47,2,4,206,205,203,143,206,136,1,141,206,136,1,34,206,206,0,1,203,0,0,141,205,136,1,125,22,206,203,205,0,0,0,15,205,20,22,143,205,137,1,141,205,137,1,125,19,205,20,22,0,0,0,0,15,11,0,0,24,19,0,1,47,0,0,119,0,7,0,141,205,109,2,0,15,205,0,0,24,41,0,141,205,23,2,38,205,205,8,0,47,205,0,20,203,24,47,0,205,203,0,143,205,138,1,39,203,15,32,0,205,203,0,143,205,139,1,141,205,139,1,32,205,205,102,121,205,16,0,1,203,0,0,141,206,15,2,15,205,203,206,143,205,141,1,141,206,141,1,141,203,15,2,1,207,0,0,125,205,206,203,207,0,0,0,143,205,142,1,141,205,142,1,0,42,205,0,1,205,0,0,143,205,19,2,119,0,83,0,141,207,15,2,34,205,207,0,143,205,143,1,141,207,143,1,141,203,119,1,141,206,15,2,125,205,207,203,206,0,0,0,143,205,144,1,141,206,144,1,141,203,144,1,34,203,203,0,41,203,203,31,42,203,203,31,141,207,135,2,1,208,64,2,3,207,207,208,25,207,207,12,134,205,0,0,116,94,0,0,206,203,207,0,143,205,145,1,141,205,227,1,141,207,145,1,4,205,205,207,34,205,205,2,121,205,23,0,141,207,145,1,0,205,207,0,143,205,18,2,141,207,18,2,26,205,207,1,143,205,147,1,141,205,147,1,1,207,48,0,83,205,207,0,141,207,227,1,141,205,147,1,4,207,207,205,34,207,207,2,121,207,5,0,141,205,147,1,0,207,205,0,143,207,18,2,119,0,242,255,141,205,147,1,0,207,205,0,143,207,17,2,119,0,4,0,141,205,145,1,0,207,205,0,143,207,17,2,141,205,15,2,42,205,205,31,0,207,205,0,143,207,148,1,141,205,17,2,26,207,205,1,143,207,149,1,141,207,149,1,141,205,148,1,38,205,205,2,25,205,205,43,1,203,255,0,19,205,205,203,83,207,205,0,1,207,255,0,19,207,15,207,0,205,207,0,143,205,150,1,141,207,17,2,26,205,207,2,143,205,152,1,141,205,152,1,141,207,150,1,83,205,207,0,141,207,227,1,141,205,152,1,4,42,207,205,141,207,152,1,0,205,207,0,143,205,19,2,141,207,68,2,25,205,207,1,143,205,153,1,141,207,153,1,3,205,207,24,143,205,154,1,141,207,154,1,141,203,138,1,33,203,203,0,38,203,203,1,3,207,207,203,3,205,207,42,143,205,155,1,1,207,32,0,141,203,113,2,141,206,155,1,141,208,23,2,134,205,0,0,216,95,0,0,0,207,203,206,208,0,0,0,82,205,0,0,143,205,156,1,141,205,156,1,38,205,205,32,32,205,205,0,121,205,6,0,141,208,74,2,141,206,68,2,134,205,0,0,204,86,0,0,208,206,0,0,1,206,48,0,141,208,113,2,141,203,155,1,141,207,23,2,2,209,0,0,0,0,1,0,21,207,207,209,134,205,0,0,216,95,0,0,0,206,208,203,207,0,0,0,141,205,139,1,32,205,205,102,121,205,233,0,141,207,248,1,16,205,25,207,143,205,158,1,141,207,158,1,141,203,248,1,125,205,207,25,203,0,0,0,143,205,77,2,141,203,77,2,0,205,203,0,143,205,8,2,141,203,8,2,82,205,203,0,143,205,159,1,141,203,159,1,1,207,0,0,134,205,0,0,116,94,0,0,203,207,75,0,143,205,160,1,141,207,8,2,141,203,77,2,13,205,207,203,143,205,161,1,141,205,161,1,121,205,17,0,141,205,160,1,52,205,205,75,160,44,0,0,141,203,160,1,0,205,203,0,143,205,94,2,119,0,46,0,141,205,135,2,3,205,205,200,1,203,48,0,107,205,8,203,141,205,135,2,3,205,205,200,25,203,205,8,143,203,94,2,119,0,37,0,141,203,135,2,3,203,203,200,141,205,160,1,55,203,203,205,232,44,0,0,141,205,160,1,0,203,205,0,143,203,94,2,119,0,28,0,141,205,135,2,3,205,205,200,1,207,48,0,141,208,160,1,141,206,57,1,4,208,208,206,135,203,2,0,205,207,208,0,141,208,160,1,0,203,208,0,143,203,93,2,141,208,93,2,26,203,208,1,143,203,162,1,141,203,135,2,3,203,203,200,141,208,162,1,48,203,203,208,68,45,0,0,141,208,162,1,0,203,208,0,143,203,93,2,119,0,245,255,141,208,162,1,0,203,208,0,143,203,94,2,119,0,1,0,82,203,0,0,143,203,163,1,141,203,163,1,38,203,203,32,32,203,203,0,121,203,10,0,141,208,94,2,0,203,208,0,143,203,164,1,141,208,94,2,141,207,164,1,4,207,75,207,134,203,0,0,204,86,0,0,208,207,0,0,141,207,8,2,25,203,207,4,143,203,165,1,141,203,165,1,55,203,25,203,184,45,0,0,141,207,165,1,0,203,207,0,143,203,8,2,119,0,165,255,141,203,138,1,32,203,203,0,120,203,12,0,82,203,0,0,143,203,166,1,141,203,166,1,38,203,203,32,32,203,203,0,120,203,2,0,119,0,5,0,1,207,1,0,134,203,0,0,204,86,0,0,202,207,0,0,141,207,165,1,141,208,132,2,16,203,207,208,143,203,168,1,1,208,0,0,15,203,208,24,143,203,169,1,141,203,169,1,141,208,168,1,19,203,203,208,121,203,93,0,0,29,24,0,141,208,165,1,0,203,208,0,143,203,9,2,141,208,9,2,82,203,208,0,143,203,170,1,141,208,170,1,1,207,0,0,134,203,0,0,116,94,0,0,208,207,75,0,143,203,171,1,141,203,135,2,3,203,203,200,141,207,171,1,48,203,203,207,208,46,0,0,141,207,135,2,3,207,207,200,1,208,48,0,141,205,171,1,141,206,57,1,4,205,205,206,135,203,2,0,207,208,205,0,141,205,171,1,0,203,205,0,143,203,96,2,141,205,96,2,26,203,205,1,143,203,172,1,141,203,135,2,3,203,203,200,141,205,172,1,48,203,203,205,192,46,0,0,141,205,172,1,0,203,205,0,143,203,96,2,119,0,245,255,141,205,172,1,0,203,205,0,143,203,95,2,119,0,4,0,141,205,171,1,0,203,205,0,143,203,95,2,82,203,0,0,143,203,174,1,141,203,174,1,38,203,203,32,32,203,203,0,121,203,14,0,1,205,9,0,15,203,205,29,143,203,175,1,141,205,175,1,1,208,9,0,125,203,205,208,29,0,0,0,143,203,176,1,141,208,95,2,141,205,176,1,134,203,0,0,204,86,0,0,208,205,0,0,141,205,9,2,25,203,205,4,143,203,177,1,26,203,29,9,143,203,178,1,141,205,177,1,141,208,132,2,16,203,205,208,143,203,179,1,1,208,9,0,15,203,208,29,143,203,180,1,141,203,180,1,141,208,179,1,19,203,203,208,121,203,7,0,141,203,178,1,0,29,203,0,141,208,177,1,0,203,208,0,143,203,9,2,119,0,172,255,141,203,178,1,0,28,203,0,119,0,2,0,0,28,24,0,25,203,28,9,143,203,181,1,1,208,48,0,141,205,181,1,1,207,9,0,1,206,0,0,134,203,0,0,216,95,0,0,0,208,205,207,206,0,0,0,119,0,213,0,141,206,248,1,25,203,206,4,143,203,182,1,141,206,132,2,141,207,182,1,125,203,38,206,207,0,0,0,143,203,130,2,1,207,255,255,15,203,207,24,143,203,183,1,141,203,183,1,121,203,172,0,32,203,47,0,143,203,184,1,0,32,24,0,141,207,248,1,0,203,207,0,143,203,10,2,141,207,10,2,82,203,207,0,143,203,185,1,141,207,185,1,1,206,0,0,134,203,0,0,116,94,0,0,207,206,75,0,143,203,186,1,141,203,186,1,45,203,203,75,92,48,0,0,141,203,135,2,3,203,203,200,1,206,48,0,107,203,8,206,141,203,135,2,3,203,203,200,25,206,203,8,143,206,97,2,119,0,4,0,141,203,186,1,0,206,203,0,143,206,97,2,141,203,10,2,141,207,248,1,13,206,203,207,143,206,187,1,141,206,187,1,121,206,43,0,141,207,97,2,25,206,207,1,143,206,190,1,82,206,0,0,143,206,191,1,141,206,191,1,38,206,206,32,32,206,206,0,121,206,6,0,141,207,97,2,1,203,1,0,134,206,0,0,204,86,0,0,207,203,0,0,34,206,32,1,143,206,192,1,141,206,184,1,141,203,192,1,19,206,206,203,121,206,5,0,141,203,190,1,0,206,203,0,143,206,99,2,119,0,61,0,82,206,0,0,143,206,193,1,141,206,193,1,38,206,206,32,32,206,206,0,120,206,5,0,141,203,190,1,0,206,203,0,143,206,99,2,119,0,51,0,1,203,1,0,134,206,0,0,204,86,0,0,202,203,0,0,141,203,190,1,0,206,203,0,143,206,99,2,119,0,43,0,141,203,135,2,3,203,203,200,141,207,97,2,16,206,203,207,143,206,188,1,141,206,188,1,120,206,5,0,141,207,97,2,0,206,207,0,143,206,99,2,119,0,32,0,141,207,97,2,1,203,0,0,141,205,57,1,4,203,203,205,3,206,207,203,143,206,100,2,141,203,135,2,3,203,203,200,1,207,48,0,141,205,100,2,135,206,2,0,203,207,205,0,141,205,97,2,0,206,205,0,143,206,98,2,141,205,98,2,26,206,205,1,143,206,189,1,141,206,135,2,3,206,206,200,141,205,189,1,48,206,206,205,192,49,0,0,141,205,189,1,0,206,205,0,143,206,98,2,119,0,245,255,141,205,189,1,0,206,205,0,143,206,99,2,119,0,1,0,141,205,99,2,0,206,205,0,143,206,195,1,82,206,0,0,143,206,196,1,141,206,196,1,38,206,206,32,32,206,206,0,121,206,19,0,141,205,195,1,4,205,75,205,15,206,205,32,143,206,197,1,141,207,197,1,121,207,5,0,141,207,195,1,4,207,75,207,0,205,207,0,119,0,2,0,0,205,32,0,0,206,205,0,143,206,198,1,141,205,99,2,141,207,198,1,134,206,0,0,204,86,0,0,205,207,0,0,141,207,195,1,4,207,75,207,4,206,32,207,143,206,199,1,141,207,10,2,25,206,207,4,143,206,200,1,141,206,200,1,141,207,130,2,16,206,206,207,1,207,255,255,141,205,199,1,15,207,207,205,19,206,206,207,121,206,7,0,141,206,199,1,0,32,206,0,141,207,200,1,0,206,207,0,143,206,10,2,119,0,95,255,141,206,199,1,0,31,206,0,119,0,2,0,0,31,24,0,25,206,31,18,143,206,201,1,1,207,48,0,141,205,201,1,1,203,18,0,1,208,0,0,134,206,0,0,216,95,0,0,0,207,205,203,208,0,0,0,82,206,0,0,143,206,202,1,141,206,202,1,38,206,206,32,32,206,206,0,120,206,2,0,119,0,11,0,141,208,19,2,0,206,208,0,143,206,203,1,141,208,19,2,141,203,227,1,141,205,203,1,4,203,203,205,134,206,0,0,204,86,0,0,208,203,0,0,1,203,32,0,141,208,113,2,141,205,155,1,141,207,23,2,1,209,0,32,21,207,207,209,134,206,0,0,216,95,0,0,0,203,208,205,207,0,0,0,141,207,155,1,141,205,113,2,15,206,207,205,143,206,204,1,141,205,204,1,141,207,113,2,141,208,155,1,125,206,205,207,208,0,0,0,143,206,115,2,141,206,115,2,0,8,206,0,119,0,90,0,141,206,109,2,38,206,206,32,33,206,206,0,1,208,251,9,1,207,255,9,125,195,206,208,207,0,0,0,70,207,13,13,59,208,0,0,59,206,0,0,70,208,208,206,20,207,207,208,0,196,207,0,141,207,109,2,38,207,207,32,33,207,207,0,1,208,3,10,1,206,7,10,125,197,207,208,206,0,0,0,1,208,0,0,141,207,68,2,125,206,196,208,207,0,0,0,143,206,70,2,125,206,196,197,195,0,0,0,143,206,92,2,1,207,32,0,141,208,113,2,141,205,70,2,25,205,205,3,134,206,0,0,216,95,0,0,0,207,208,205,90,0,0,0,82,198,0,0,38,206,198,32,32,206,206,0,121,206,10,0,141,205,74,2,141,208,70,2,134,206,0,0,204,86,0,0,205,208,0,0,82,46,0,0,0,206,46,0,143,206,0,1,119,0,3,0,0,206,198,0,143,206,0,1,141,206,0,1,38,206,206,32,0,199,206,0,32,206,199,0,121,206,6,0,141,208,92,2,1,205,3,0,134,206,0,0,204,86,0,0,208,205,0,0,1,205,32,0,141,208,113,2,141,207,70,2,25,207,207,3,141,203,23,2,1,209,0,32,21,203,203,209,134,206,0,0,216,95,0,0,0,205,208,207,203,0,0,0,141,203,70,2,25,203,203,3,141,207,113,2,15,206,203,207,143,206,1,1,141,203,1,1,121,203,4,0,141,203,113,2,0,207,203,0,119,0,4,0,141,203,70,2,25,203,203,3,0,207,203,0,0,206,207,0,143,206,2,1,141,206,2,1,0,8,206,0,141,207,255,1,0,206,207,0,143,206,254,1,0,206,8,0,143,206,48,2,141,207,57,2,0,206,207,0,143,206,52,2,0,206,79,0,143,206,81,2,119,0,240,242,119,0,44,247,119,0,43,247,119,0,240,246,134,159,0,0,220,140,0,0,82,160,159,0,134,161,0,0,8,97,0,0,160,0,0,0,0,205,161,0,143,205,237,1,1,205,82,0,143,205,134,2,119,0,27,1,141,203,104,2,1,205,0,0,1,206,8,0,138,203,205,206,140,53,0,0,200,53,0,0,4,54,0,0,84,54,0,0,160,54,0,0,96,53,0,0,232,54,0,0,36,55,0,0,141,206,255,1,0,205,206,0,143,205,254,1,4,205,168,174,143,205,48,2,141,206,57,2,0,205,206,0,143,205,52,2,0,205,79,0,143,205,81,2,119,0,203,242,141,205,135,2,82,94,205,0,141,205,255,1,85,94,205,0,141,206,255,1,0,205,206,0,143,205,254,1,4,205,168,174,143,205,48,2,141,206,57,2,0,205,206,0,143,205,52,2,0,205,79,0,143,205,81,2,119,0,188,242,141,205,135,2,82,95,205,0,141,205,255,1,85,95,205,0,141,206,255,1,0,205,206,0,143,205,254,1,4,205,168,174,143,205,48,2,141,206,57,2,0,205,206,0,143,205,52,2,0,205,79,0,143,205,81,2,119,0,173,242,141,205,255,1,34,96,205,0,141,205,135,2,82,97,205,0,141,205,255,1,85,97,205,0,41,206,96,31,42,206,206,31,109,97,4,206,141,205,255,1,0,206,205,0,143,206,254,1,4,206,168,174,143,206,48,2,141,205,57,2,0,206,205,0,143,206,52,2,0,206,79,0,143,206,81,2,119,0,153,242,141,206,255,1,2,205,0,0,255,255,0,0,19,206,206,205,0,99,206,0,141,206,135,2,82,100,206,0,84,100,99,0,141,205,255,1,0,206,205,0,143,206,254,1,4,206,168,174,143,206,48,2,141,205,57,2,0,206,205,0,143,206,52,2,0,206,79,0,143,206,81,2,119,0,134,242,141,206,255,1,1,205,255,0,19,206,206,205,0,101,206,0,141,206,135,2,82,102,206,0,83,102,101,0,141,205,255,1,0,206,205,0,143,206,254,1,4,206,168,174,143,206,48,2,141,205,57,2,0,206,205,0,143,206,52,2,0,206,79,0,143,206,81,2,119,0,116,242,141,206,135,2,82,103,206,0,141,206,255,1,85,103,206,0,141,205,255,1,0,206,205,0,143,206,254,1,4,206,168,174,143,206,48,2,141,205,57,2,0,206,205,0,143,206,52,2,0,206,79,0,143,206,81,2,119,0,101,242,141,206,255,1,34,104,206,0,141,206,135,2,82,105,206,0,141,206,255,1,85,105,206,0,41,205,104,31,42,205,205,31,109,105,4,205,141,206,255,1,0,205,206,0,143,205,254,1,4,205,168,174,143,205,48,2,141,206,57,2,0,205,206,0,143,205,52,2,0,205,79,0,143,205,81,2,119,0,81,242,141,203,135,2,82,126,203,0,141,203,135,2,106,127,203,4,32,203,126,0,32,205,127,0,19,203,203,205,121,203,3,0,0,9,53,0,119,0,26,0,0,12,53,0,0,130,126,0,0,132,127,0,38,203,130,7,0,129,203,0,26,131,12,1,39,203,129,48,1,205,255,0,19,203,203,205,83,131,203,0,1,203,3,0,135,133,3,0,130,132,203,0,128,203,0,0,0,135,203,0,32,203,133,0,32,205,135,0,19,203,203,205,121,203,3,0,0,9,131,0,119,0,5,0,0,12,131,0,0,130,133,0,0,132,135,0,119,0,235,255,141,203,23,2,38,203,203,8,32,203,203,0,121,203,16,0,0,203,9,0,143,203,236,1,141,205,23,2,0,203,205,0,143,203,25,2,141,205,59,2,0,203,205,0,143,203,62,2,1,203,0,0,143,203,69,2,1,203,115,2,143,203,75,2,1,203,77,0,143,203,134,2,119,0,84,0,0,136,9,0,4,203,53,136,141,205,59,2,15,137,203,205,121,137,4,0,141,206,59,2,0,203,206,0,119,0,4,0,4,206,53,136,25,206,206,1,0,203,206,0,0,205,203,0,143,205,60,2,0,205,9,0,143,205,236,1,141,203,23,2,0,205,203,0,143,205,25,2,141,203,60,2,0,205,203,0,143,205,62,2,1,205,0,0,143,205,69,2,1,205,115,2,143,205,75,2,1,205,77,0,143,205,134,2,119,0,56,0,1,203,8,0,141,205,59,2,16,107,203,205,141,205,59,2,1,203,8,0,125,108,107,205,203,0,0,0,141,205,23,2,39,205,205,8,0,203,205,0,143,203,24,2,0,203,108,0,143,203,61,2,1,203,120,0,143,203,110,2,1,203,64,0,143,203,134,2,119,0,38,0,141,205,135,2,82,162,205,0,1,205,0,0,14,205,162,205,1,206,225,9,125,163,205,162,206,0,0,0,0,206,163,0,143,206,237,1,1,206,82,0,143,206,134,2,119,0,26,0,141,206,135,2,82,91,206,0,141,206,135,2,106,93,206,4,0,143,91,0,0,144,93,0,1,206,0,0,143,206,67,2,1,206,115,2,143,206,72,2,1,206,76,0,143,206,134,2,119,0,13,0,141,205,23,2,0,203,205,0,143,203,24,2,141,205,59,2,0,203,205,0,143,203,61,2,141,205,109,2,0,203,205,0,143,203,110,2,1,203,64,0,143,203,134,2,119,0,1,0,141,204,134,2,32,204,204,64,121,204,103,0,1,204,0,0,143,204,134,2,141,204,135,2,82,109,204,0,141,204,135,2,106,111,204,4,141,204,110,2,38,204,204,32,0,112,204,0,32,204,109,0,32,206,111,0,19,204,204,206,121,204,16,0,0,204,53,0,143,204,236,1,141,206,24,2,0,204,206,0,143,204,25,2,141,206,61,2,0,204,206,0,143,204,62,2,1,204,0,0,143,204,69,2,1,204,115,2,143,204,75,2,1,204,77,0,143,204,134,2,119,0,31,1,0,10,53,0,0,114,109,0,0,118,111,0,38,204,114,15,0,113,204,0,1,204,99,2,90,116,204,113,26,117,10,1,1,204,255,0,19,204,116,204,20,204,204,112,1,206,255,0,19,204,204,206,83,117,204,0,1,204,4,0,135,119,3,0,114,118,204,0,128,204,0,0,0,120,204,0,32,204,119,0,32,206,120,0,19,204,204,206,120,204,5,0,0,10,117,0,0,114,119,0,0,118,120,0,119,0,233,255,141,204,135,2,82,121,204,0,141,204,135,2,106,122,204,4,141,204,24,2,38,204,204,8,0,124,204,0,32,204,124,0,32,206,121,0,32,207,122,0,19,206,206,207,20,204,204,206,121,204,16,0,0,204,117,0,143,204,236,1,141,206,24,2,0,204,206,0,143,204,25,2,141,206,61,2,0,204,206,0,143,204,62,2,1,204,0,0,143,204,69,2,1,204,115,2,143,204,75,2,1,204,77,0,143,204,134,2,119,0,232,0,141,204,110,2,42,204,204,4,0,125,204,0,0,204,117,0,143,204,236,1,141,206,24,2,0,204,206,0,143,204,25,2,141,206,61,2,0,204,206,0,143,204,62,2,1,204,2,0,143,204,69,2,1,206,115,2,3,204,206,125,143,204,75,2,1,204,77,0,143,204,134,2,119,0,213,0,141,204,134,2,32,204,204,76,121,204,23,0,1,204,0,0,143,204,134,2,134,145,0,0,116,94,0,0,143,144,53,0,0,204,145,0,143,204,236,1,141,206,23,2,0,204,206,0,143,204,25,2,141,206,59,2,0,204,206,0,143,204,62,2,141,206,67,2,0,204,206,0,143,204,69,2,141,206,72,2,0,204,206,0,143,204,75,2,1,204,77,0,143,204,134,2,119,0,188,0,141,204,134,2,32,204,204,82,121,204,45,0,1,204,0,0,143,204,134,2,141,204,237,1,1,206,0,0,141,207,59,2,134,164,0,0,96,80,0,0,204,206,207,0,141,207,237,1,0,165,207,0,141,207,237,1,141,206,59,2,3,166,207,206,1,207,0,0,13,207,164,207,125,206,207,166,164,0,0,0,143,206,121,2,1,204,0,0,45,204,164,204,12,60,0,0,141,204,59,2,0,207,204,0,119,0,3,0,4,204,164,165,0,207,204,0,0,206,207,0,143,206,64,2,141,207,237,1,0,206,207,0,143,206,240,1,0,206,90,0,143,206,26,2,141,207,64,2,0,206,207,0,143,206,66,2,1,206,0,0,143,206,71,2,1,206,115,2,143,206,76,2,141,207,121,2,0,206,207,0,143,206,124,2,119,0,141,0,141,206,134,2,32,206,206,86,121,206,138,0,1,206,0,0,143,206,134,2,1,206,0,0,143,206,29,2,1,206,0,0,143,206,50,2,141,207,222,1,0,206,207,0,143,206,116,2,141,206,116,2,82,171,206,0,32,206,171,0,121,206,8,0,141,207,29,2,0,206,207,0,143,206,27,2,141,207,50,2,0,206,207,0,143,206,51,2,119,0,39,0,141,206,135,2,1,207,16,2,3,206,206,207,134,172,0,0,28,141,0,0,206,171,0,0,141,206,65,2,141,207,29,2,4,173,206,207,34,207,172,0,16,206,173,172,20,207,207,206,121,207,7,0,141,206,29,2,0,207,206,0,143,207,27,2,0,207,172,0,143,207,51,2,119,0,20,0,141,207,116,2,25,175,207,4,141,207,29,2,3,176,172,207,141,207,65,2,16,177,176,207,121,177,8,0,0,207,176,0,143,207,29,2,0,207,172,0,143,207,50,2,0,207,175,0,143,207,116,2,119,0,213,255,0,207,176,0,143,207,27,2,0,207,172,0,143,207,51,2,119,0,1,0,141,207,51,2,34,178,207,0,121,178,3,0,1,7,255,255,119,0,40,1,1,206,32,0,141,204,113,2,141,203,27,2,141,208,23,2,134,207,0,0,216,95,0,0,0,206,204,203,208,0,0,0,141,207,27,2,32,179,207,0,121,179,6,0,1,207,0,0,143,207,28,2,1,207,97,0,143,207,134,2,119,0,59,0,1,207,0,0,143,207,34,2,141,208,222,1,0,207,208,0,143,207,117,2,141,207,117,2,82,180,207,0,32,207,180,0,121,207,7,0,141,208,27,2,0,207,208,0,143,207,28,2,1,207,97,0,143,207,134,2,119,0,44,0,141,207,117,2,25,181,207,4,141,207,135,2,1,208,16,2,3,207,207,208,134,182,0,0,28,141,0,0,207,180,0,0,141,207,34,2,3,183,182,207,141,207,27,2,15,184,207,183,121,184,7,0,141,208,27,2,0,207,208,0,143,207,28,2,1,207,97,0,143,207,134,2,119,0,25,0,82,185,0,0,38,207,185,32,32,207,207,0,121,207,7,0,141,208,135,2,1,203,16,2,3,208,208,203,134,207,0,0,204,86,0,0,208,182,0,0,141,207,27,2,16,186,183,207,121,186,6,0,0,207,183,0,143,207,34,2,0,207,181,0,143,207,117,2,119,0,210,255,141,208,27,2,0,207,208,0,143,207,28,2,1,207,97,0,143,207,134,2,119,0,1,0,141,207,134,2,32,207,207,97,121,207,31,0,1,207,0,0,143,207,134,2,1,208,32,0,141,203,113,2,141,204,28,2,141,206,23,2,1,205,0,32,21,206,206,205,134,207,0,0,216,95,0,0,0,208,203,204,206,0,0,0,141,207,28,2,141,206,113,2,15,187,207,206,141,206,113,2,141,207,28,2,125,188,187,206,207,0,0,0,141,206,255,1,0,207,206,0,143,207,254,1,0,207,188,0,143,207,48,2,141,206,57,2,0,207,206,0,143,207,52,2,0,207,79,0,143,207,81,2,119,0,106,240,141,207,134,2,32,207,207,77,121,207,71,0,1,207,0,0,143,207,134,2,1,207,255,255,141,206,62,2,15,147,207,206,141,206,25,2,2,207,0,0,255,255,254,255,19,206,206,207,0,148,206,0,141,206,25,2,125,36,147,148,206,0,0,0,141,206,135,2,82,149,206,0,141,206,135,2,106,150,206,4,141,206,62,2,33,152,206,0,33,206,149,0,33,207,150,0,20,206,206,207,20,206,152,206,121,206,33,0,141,206,236,1,0,153,206,0,33,206,149,0,33,207,150,0,20,206,206,207,38,206,206,1,40,206,206,1,4,207,53,153,3,154,206,207,141,207,62,2,15,155,154,207,141,206,62,2,125,207,155,206,154,0,0,0,143,207,63,2,141,206,236,1,0,207,206,0,143,207,240,1,0,207,36,0,143,207,26,2,141,206,63,2,0,207,206,0,143,207,66,2,141,206,69,2,0,207,206,0,143,207,71,2,141,206,75,2,0,207,206,0,143,207,76,2,0,207,53,0,143,207,124,2,119,0,15,0,0,207,53,0,143,207,240,1,0,207,36,0,143,207,26,2,1,207,0,0,143,207,66,2,141,206,69,2,0,207,206,0,143,207,71,2,141,206,75,2,0,207,206,0,143,207,76,2,0,207,53,0,143,207,124,2,141,206,124,2,0,207,206,0,143,207,205,1,141,206,240,1,0,207,206,0,143,207,206,1,141,206,66,2,141,204,205,1,141,203,206,1,4,204,204,203,15,207,206,204,143,207,207,1,141,204,207,1,121,204,6,0,141,204,205,1,141,206,206,1,4,204,204,206,0,207,204,0,119,0,3,0,141,204,66,2,0,207,204,0,0,40,207,0,141,204,71,2,3,207,204,40,143,207,208,1,141,204,113,2,141,206,208,1,15,207,204,206,143,207,209,1,141,206,209,1,141,204,208,1,141,203,113,2,125,207,206,204,203,0,0,0,143,207,114,2,1,203,32,0,141,204,114,2,141,206,208,1,141,208,26,2,134,207,0,0,216,95,0,0,0,203,204,206,208,0,0,0,82,207,0,0,143,207,210,1,141,207,210,1,38,207,207,32,32,207,207,0,121,207,6,0,141,208,76,2,141,206,71,2,134,207,0,0,204,86,0,0,208,206,0,0,141,206,26,2,2,208,0,0,0,0,1,0,21,206,206,208,0,207,206,0,143,207,211,1,1,206,48,0,141,208,114,2,141,204,208,1,141,203,211,1,134,207,0,0,216,95,0,0,0,206,208,204,203,0,0,0,1,203,48,0,141,204,205,1,141,208,206,1,4,204,204,208,1,208,0,0,134,207,0,0,216,95,0,0,0,203,40,204,208,0,0,0,82,207,0,0,143,207,212,1,141,207,212,1,38,207,207,32,32,207,207,0,121,207,8,0,141,208,240,1,141,204,205,1,141,203,206,1,4,204,204,203,134,207,0,0,204,86,0,0,208,204,0,0,141,204,26,2,1,208,0,32,21,204,204,208,0,207,204,0,143,207,213,1,1,204,32,0,141,208,114,2,141,203,208,1,141,206,213,1,134,207,0,0,216,95,0,0,0,204,208,203,206,0,0,0,141,206,255,1,0,207,206,0,143,207,254,1,141,206,114,2,0,207,206,0,143,207,48,2,141,206,57,2,0,207,206,0,143,207,52,2,0,207,79,0,143,207,81,2,119,0,174,239,141,207,134,2,1,206,244,0,45,207,207,206,76,67,0,0,1,207,0,0,45,207,0,207,68,67,0,0,141,207,53,2,32,207,207,0,121,207,3,0,1,7,0,0,119,0,72,0,1,207,1,0,143,207,37,2,141,206,37,2,41,206,206,2,3,207,4,206,143,207,214,1,141,206,214,1,82,207,206,0,143,207,215,1,141,207,215,1,32,207,207,0,121,207,5,0,141,206,37,2,0,207,206,0,143,207,38,2,119,0,22,0,141,206,37,2,41,206,206,3,3,207,3,206,143,207,217,1,141,206,217,1,141,203,215,1,134,207,0,0,88,67,0,0,206,203,2,0,141,203,37,2,25,207,203,1,143,207,218,1,141,207,218,1,34,207,207,10,121,207,5,0,141,203,218,1,0,207,203,0,143,207,37,2,119,0,224,255,1,7,1,0,119,0,35,0,141,207,38,2,34,207,207,10,121,207,28,0,141,203,38,2,0,207,203,0,143,207,40,2,141,203,40,2,41,203,203,2,3,207,4,203,143,207,220,1,141,203,220,1,82,207,203,0,143,207,221,1,141,203,40,2,25,207,203,1,143,207,219,1,141,207,221,1,32,207,207,0,120,207,3,0,1,7,255,255,119,0,14,0,141,207,219,1,34,207,207,10,121,207,5,0,141,203,219,1,0,207,203,0,143,207,40,2,119,0,235,255,1,7,1,0,119,0,5,0,1,7,1,0,119,0,3,0,141,207,0,2,0,7,207,0,141,207,135,2,137,207,0,0,139,7,0,0,140,3,195,0,0,0,0,0,2,191,0,0,255,255,0,0,2,192,0,0,255,0,0,0,1,189,0,0,136,193,0,0,0,190,193,0,1,193,20,0,16,5,193,1,120,5,38,1,1,193,9,0,1,194,10,0,138,1,193,194,192,67,0,0,20,68,0,0,140,68,0,0,248,68,0,0,116,69,0,0,0,70,0,0,116,70,0,0,0,71,0,0,116,71,0,0,200,71,0,0,119,0,24,1,82,119,2,0,0,6,119,0,1,193,0,0,25,31,193,4,0,140,31,0,26,139,140,1,3,42,6,139,1,193,0,0,25,53,193,4,0,143,53,0,26,142,143,1,40,193,142,255,0,141,193,0,19,193,42,141,0,64,193,0,0,75,64,0,82,86,75,0,25,129,75,4,85,2,129,0,85,0,86,0,119,0,3,1,82,123,2,0,0,97,123,0,1,193,0,0,25,108,193,4,0,145,108,0,26,144,145,1,3,7,97,144,1,193,0,0,25,18,193,4,0,148,18,0,26,147,148,1,40,193,147,255,0,146,193,0,19,193,7,146,0,23,193,0,0,24,23,0,82,25,24,0,25,136,24,4,85,2,136,0,34,26,25,0,41,193,26,31,42,193,193,31,0,27,193,0,0,28,0,0,0,29,28,0,85,29,25,0,25,30,28,4,0,32,30,0,85,32,27,0,119,0,229,0,82,127,2,0,0,33,127,0,1,193,0,0,25,34,193,4,0,150,34,0,26,149,150,1,3,35,33,149,1,193,0,0,25,36,193,4,0,153,36,0,26,152,153,1,40,193,152,255,0,151,193,0,19,193,35,151,0,37,193,0,0,38,37,0,82,39,38,0,25,137,38,4,85,2,137,0,0,40,0,0,0,41,40,0,85,41,39,0,25,43,40,4,0,44,43,0,1,193,0,0,85,44,193,0,119,0,202,0,82,128,2,0,0,45,128,0,1,193,0,0,25,46,193,8,0,155,46,0,26,154,155,1,3,47,45,154,1,193,0,0,25,48,193,8,0,158,48,0,26,157,158,1,40,193,157,255,0,156,193,0,19,193,47,156,0,49,193,0,0,50,49,0,0,51,50,0,0,52,51,0,82,54,52,0,25,55,51,4,0,56,55,0,82,57,56,0,25,138,50,8,85,2,138,0,0,58,0,0,0,59,58,0,85,59,54,0,25,60,58,4,0,61,60,0,85,61,57,0,119,0,171,0,82,120,2,0,0,62,120,0,1,193,0,0,25,63,193,4,0,160,63,0,26,159,160,1,3,65,62,159,1,193,0,0,25,66,193,4,0,163,66,0,26,162,163,1,40,193,162,255,0,161,193,0,19,193,65,161,0,67,193,0,0,68,67,0,82,69,68,0,25,130,68,4,85,2,130,0,19,193,69,191,0,70,193,0,41,193,70,16,42,193,193,16,0,71,193,0,34,72,71,0,41,193,72,31,42,193,193,31,0,73,193,0,0,74,0,0,0,76,74,0,85,76,71,0,25,77,74,4,0,78,77,0,85,78,73,0,119,0,136,0,82,121,2,0,0,79,121,0,1,193,0,0,25,80,193,4,0,165,80,0,26,164,165,1,3,81,79,164,1,193,0,0,25,82,193,4,0,168,82,0,26,167,168,1,40,193,167,255,0,166,193,0,19,193,81,166,0,83,193,0,0,84,83,0,82,85,84,0,25,131,84,4,85,2,131,0,19,193,85,191,0,4,193,0,0,87,0,0,0,88,87,0,85,88,4,0,25,89,87,4,0,90,89,0,1,193,0,0,85,90,193,0,119,0,107,0,82,122,2,0,0,91,122,0,1,193,0,0,25,92,193,4,0,170,92,0,26,169,170,1,3,93,91,169,1,193,0,0,25,94,193,4,0,173,94,0,26,172,173,1,40,193,172,255,0,171,193,0,19,193,93,171,0,95,193,0,0,96,95,0,82,98,96,0,25,132,96,4,85,2,132,0,19,193,98,192,0,99,193,0,41,193,99,24,42,193,193,24,0,100,193,0,34,101,100,0,41,193,101,31,42,193,193,31,0,102,193,0,0,103,0,0,0,104,103,0,85,104,100,0,25,105,103,4,0,106,105,0,85,106,102,0,119,0,72,0,82,124,2,0,0,107,124,0,1,193,0,0,25,109,193,4,0,175,109,0,26,174,175,1,3,110,107,174,1,193,0,0,25,111,193,4,0,178,111,0,26,177,178,1,40,193,177,255,0,176,193,0,19,193,110,176,0,112,193,0,0,113,112,0,82,114,113,0,25,133,113,4,85,2,133,0,19,193,114,192,0,3,193,0,0,115,0,0,0,116,115,0,85,116,3,0,25,117,115,4,0,118,117,0,1,193,0,0,85,118,193,0,119,0,43,0,82,125,2,0,0,8,125,0,1,193,0,0,25,9,193,8,0,180,9,0,26,179,180,1,3,10,8,179,1,193,0,0,25,11,193,8,0,183,11,0,26,182,183,1,40,193,182,255,0,181,193,0,19,193,10,181,0,12,193,0,0,13,12,0,86,14,13,0,25,134,13,8,85,2,134,0,87,0,14,0,119,0,22,0,82,126,2,0,0,15,126,0,1,193,0,0,25,16,193,8,0,185,16,0,26,184,185,1,3,17,15,184,1,193,0,0,25,19,193,8,0,188,19,0,26,187,188,1,40,193,187,255,0,186,193,0,19,193,17,186,0,20,193,0,0,21,20,0,86,22,21,0,25,135,21,8,85,2,135,0,87,0,22,0,119,0,1,0,139,0,0,0,140,5,75,0,0,0,0,0,0,5,0,0,0,6,1,0,0,7,6,0,0,8,2,0,0,9,3,0,0,10,9,0,32,69,7,0,121,69,27,0,33,11,4,0,32,69,10,0,121,69,11,0,121,11,5,0,9,69,5,8,85,4,69,0,1,70,0,0,109,4,4,70,1,68,0,0,7,67,5,8,129,68,0,0,139,67,0,0,119,0,14,0,120,11,5,0,1,68,0,0,1,67,0,0,129,68,0,0,139,67,0,0,38,70,0,255,85,4,70,0,38,69,1,0,109,4,4,69,1,68,0,0,1,67,0,0,129,68,0,0,139,67,0,0,32,12,10,0,32,69,8,0,121,69,83,0,121,12,11,0,33,69,4,0,121,69,5,0,9,69,7,8,85,4,69,0,1,70,0,0,109,4,4,70,1,68,0,0,7,67,7,8,129,68,0,0,139,67,0,0,32,70,5,0,121,70,11,0,33,70,4,0,121,70,5,0,1,70,0,0,85,4,70,0,9,69,7,10,109,4,4,69,1,68,0,0,7,67,7,10,129,68,0,0,139,67,0,0,26,13,10,1,19,69,13,10,32,69,69,0,121,69,18,0,33,69,4,0,121,69,8,0,38,69,0,255,39,69,69,0,85,4,69,0,19,70,13,7,38,71,1,0,20,70,70,71,109,4,4,70,1,68,0,0,134,70,0,0,192,139,0,0,10,0,0,0,24,70,7,70,0,67,70,0,129,68,0,0,139,67,0,0,135,14,4,0,10,0,0,0,135,70,4,0,7,0,0,0,4,15,14,70,37,70,15,30,121,70,15,0,25,16,15,1,1,70,31,0,4,17,70,15,0,36,16,0,22,70,7,17,24,69,5,16,20,70,70,69,0,35,70,0,24,70,7,16,0,34,70,0,1,33,0,0,22,70,5,17,0,32,70,0,119,0,139,0,32,70,4,0,121,70,5,0,1,68,0,0,1,67,0,0,129,68,0,0,139,67,0,0,38,70,0,255,39,70,70,0,85,4,70,0,38,69,1,0,20,69,6,69,109,4,4,69,1,68,0,0,1,67,0,0,129,68,0,0,139,67,0,0,119,0,122,0,120,12,43,0,135,27,4,0,10,0,0,0,135,69,4,0,7,0,0,0,4,28,27,69,37,69,28,31,121,69,20,0,25,29,28,1,1,69,31,0,4,30,69,28,26,69,28,31,42,69,69,31,0,31,69,0,0,36,29,0,24,69,5,29,19,69,69,31,22,70,7,30,20,69,69,70,0,35,69,0,24,69,7,29,19,69,69,31,0,34,69,0,1,33,0,0,22,69,5,30,0,32,69,0,119,0,95,0,32,69,4,0,121,69,5,0,1,68,0,0,1,67,0,0,129,68,0,0,139,67,0,0,38,69,0,255,39,69,69,0,85,4,69,0,38,70,1,0,20,70,6,70,109,4,4,70,1,68,0,0,1,67,0,0,129,68,0,0,139,67,0,0,26,18,8,1,19,70,18,8,33,70,70,0,121,70,44,0,135,70,4,0,8,0,0,0,25,20,70,33,135,70,4,0,7,0,0,0,4,21,20,70,1,70,64,0,4,22,70,21,1,70,32,0,4,23,70,21,42,70,23,31,0,24,70,0,26,25,21,32,42,70,25,31,0,26,70,0,0,36,21,0,26,70,23,1,42,70,70,31,24,69,7,25,19,70,70,69,22,69,7,23,24,71,5,21,20,69,69,71,19,69,69,26,20,70,70,69,0,35,70,0,24,70,7,21,19,70,26,70,0,34,70,0,22,70,5,22,19,70,70,24,0,33,70,0,22,70,7,22,24,69,5,25,20,70,70,69,19,70,70,24,22,69,5,23,26,71,21,33,42,71,71,31,19,69,69,71,20,70,70,69,0,32,70,0,119,0,32,0,33,70,4,0,121,70,5,0,19,70,18,5,85,4,70,0,1,69,0,0,109,4,4,69,32,69,8,1,121,69,10,0,38,69,1,0,20,69,6,69,0,68,69,0,38,69,0,255,39,69,69,0,0,67,69,0,129,68,0,0,139,67,0,0,119,0,15,0,134,19,0,0,192,139,0,0,8,0,0,0,24,69,7,19,39,69,69,0,0,68,69,0,1,69,32,0,4,69,69,19,22,69,7,69,24,70,5,19,20,69,69,70,0,67,69,0,129,68,0,0,139,67,0,0,32,69,36,0,121,69,8,0,0,63,32,0,0,62,33,0,0,61,34,0,0,60,35,0,1,59,0,0,1,58,0,0,119,0,89,0,38,69,2,255,39,69,69,0,0,37,69,0,38,69,3,0,20,69,9,69,0,38,69,0,1,69,255,255,1,70,255,255,134,39,0,0,52,142,0,0,37,38,69,70,128,70,0,0,0,40,70,0,0,46,32,0,0,45,33,0,0,44,34,0,0,43,35,0,0,42,36,0,1,41,0,0,43,70,45,31,41,69,46,1,20,70,70,69,0,47,70,0,41,70,45,1,20,70,41,70,0,48,70,0,41,70,43,1,43,69,46,31,20,70,70,69,39,70,70,0,0,49,70,0,43,70,43,31,41,69,44,1,20,70,70,69,0,50,70,0,134,70,0,0,188,141,0,0,39,40,49,50,128,70,0,0,0,51,70,0,42,70,51,31,34,71,51,0,1,72,255,255,1,73,0,0,125,69,71,72,73,0,0,0,41,69,69,1,20,70,70,69,0,52,70,0,38,70,52,1,0,53,70,0,19,70,52,37,34,73,51,0,1,72,255,255,1,71,0,0,125,69,73,72,71,0,0,0,42,69,69,31,34,72,51,0,1,73,255,255,1,74,0,0,125,71,72,73,74,0,0,0,41,71,71,1,20,69,69,71,19,69,69,38,134,54,0,0,188,141,0,0,49,50,70,69,0,55,54,0,128,69,0,0,0,56,69,0,26,57,42,1,32,69,57,0,120,69,8,0,0,46,47,0,0,45,48,0,0,44,56,0,0,43,55,0,0,42,57,0,0,41,53,0,119,0,194,255,0,63,47,0,0,62,48,0,0,61,56,0,0,60,55,0,1,59,0,0,0,58,53,0,0,64,62,0,1,65,0,0,20,69,63,65,0,66,69,0,33,69,4,0,121,69,4,0,39,69,60,0,85,4,69,0,109,4,4,61,39,69,64,0,43,69,69,31,41,70,66,1,20,69,69,70,41,70,65,1,43,71,64,31,20,70,70,71,38,70,70,0,20,69,69,70,20,69,69,59,0,68,69,0,41,69,64,1,1,70,0,0,43,70,70,31,20,69,69,70,38,69,69,254,20,69,69,58,0,67,69,0,129,68,0,0,139,67,0,0,140,3,77,0,0,0,0,0,2,74,0,0,146,0,0,0,1,72,0,0,136,75,0,0,0,73,75,0,136,75,0,0,25,75,75,48,137,75,0,0,130,75,0,0,136,76,0,0,49,75,75,76,28,78,0,0,135,75,0,0,25,67,73,16,0,66,73,0,25,64,73,32,25,6,0,28,82,7,6,0,85,64,7,0,25,18,64,4,25,29,0,20,82,40,29,0,4,51,40,7,85,18,51,0,25,52,64,8,85,52,1,0,25,53,64,12,85,53,2,0,3,54,51,2,25,55,0,60,25,8,0,44,0,58,64,0,1,61,2,0,0,65,54,0,1,75,44,10,82,9,75,0,1,75,0,0,13,10,9,75,121,10,14,0,82,14,55,0,85,67,14,0,25,70,67,4,85,70,58,0,25,71,67,8,85,71,61,0,135,15,5,0,74,67,0,0,134,16,0,0,152,140,0,0,15,0,0,0,0,56,16,0,119,0,19,0,1,76,7,0,135,75,6,0,76,0,0,0,82,11,55,0,85,66,11,0,25,68,66,4,85,68,58,0,25,69,66,8,85,69,61,0,135,12,5,0,74,66,0,0,134,13,0,0,152,140,0,0,12,0,0,0,1,76,0,0,135,75,7,0,76,0,0,0,0,56,13,0,13,17,65,56,121,17,3,0,1,72,6,0,119,0,49,0,34,25,56,0,121,25,5,0,0,59,58,0,0,62,61,0,1,72,8,0,119,0,43,0,4,34,65,56,25,35,58,4,82,36,35,0,16,37,36,56,121,37,14,0,82,38,8,0,85,6,38,0,85,29,38,0,4,39,56,36,25,41,58,8,26,42,61,1,25,4,58,12,82,5,4,0,0,50,5,0,0,57,39,0,0,60,41,0,0,63,42,0,119,0,15,0,32,43,61,2,121,43,9,0,82,44,6,0,3,45,44,56,85,6,45,0,0,50,36,0,0,57,56,0,0,60,58,0,1,63,2,0,119,0,5,0,0,50,36,0,0,57,56,0,0,60,58,0,0,63,61,0,82,46,60,0,3,47,46,57,85,60,47,0,25,48,60,4,4,49,50,57,85,48,49,0,0,58,60,0,0,61,63,0,0,65,34,0,119,0,169,255,32,75,72,6,121,75,12,0,82,19,8,0,25,20,0,48,82,21,20,0,3,22,19,21,25,23,0,16,85,23,22,0,0,24,19,0,85,6,24,0,85,29,24,0,0,3,2,0], eb + 10240);
  HEAPU8.set([119,0,22,0,32,75,72,8,121,75,20,0,25,26,0,16,1,75,0,0,85,26,75,0,1,75,0,0,85,6,75,0,1,75,0,0,85,29,75,0,82,27,0,0,39,75,27,32,0,28,75,0,85,0,28,0,32,30,62,2,121,30,3,0,1,3,0,0,119,0,5,0,25,31,59,4,82,32,31,0,4,33,2,32,0,3,33,0,137,73,0,0,139,3,0,0,140,3,66,0,0,0,0,0,2,61,0,0,128,128,128,128,2,62,0,0,255,254,254,254,2,63,0,0,255,0,0,0,1,59,0,0,136,64,0,0,0,60,64,0,19,64,1,63,0,12,64,0,0,13,0,0,38,64,13,3,0,24,64,0,33,35,24,0,33,43,2,0,19,64,43,35,0,50,64,0,121,50,34,0,19,64,1,63,0,44,64,0,0,5,2,0,0,53,0,0,78,45,53,0,41,64,45,24,42,64,64,24,41,65,44,24,42,65,65,24,13,46,64,65,121,46,5,0,0,4,5,0,0,52,53,0,1,59,6,0,119,0,23,0,25,47,53,1,26,48,5,1,0,14,47,0,38,65,14,3,0,15,65,0,33,16,15,0,33,17,48,0,19,65,17,16,0,49,65,0,121,49,4,0,0,5,48,0,0,53,47,0,119,0,233,255,0,3,48,0,0,11,17,0,0,51,47,0,1,59,5,0,119,0,5,0,0,3,2,0,0,11,43,0,0,51,0,0,1,59,5,0,32,65,59,5,121,65,8,0,121,11,5,0,0,4,3,0,0,52,51,0,1,59,6,0,119,0,3,0,1,10,0,0,0,55,51,0,32,65,59,6,121,65,85,0,78,18,52,0,19,65,1,63,0,19,65,0,41,65,18,24,42,65,65,24,41,64,19,24,42,64,64,24,13,20,65,64,121,20,4,0,0,10,4,0,0,55,52,0,119,0,73,0,2,64,0,0,1,1,1,1,5,21,12,64,1,64,3,0,16,22,64,4,121,22,35,0,0,7,4,0,0,57,52,0,82,23,57,0,21,64,23,21,0,25,64,0,2,64,0,0,1,1,1,1,4,26,25,64,19,64,25,61,0,27,64,0,21,64,27,61,0,28,64,0,19,64,28,26,0,29,64,0,32,30,29,0,120,30,4,0,0,8,7,0,0,58,57,0,119,0,13,0,25,31,57,4,26,32,7,4,1,64,3,0,16,33,64,32,121,33,4,0,0,7,32,0,0,57,31,0,119,0,232,255,0,6,32,0,0,56,31,0,1,59,11,0,119,0,7,0,0,9,8,0,0,54,58,0,119,0,4,0,0,6,4,0,0,56,52,0,1,59,11,0,32,64,59,11,121,64,8,0,32,34,6,0,121,34,4,0,1,10,0,0,0,55,56,0,119,0,23,0,0,9,6,0,0,54,56,0,78,36,54,0,41,64,36,24,42,64,64,24,41,65,19,24,42,65,65,24,13,37,64,65,121,37,4,0,0,10,9,0,0,55,54,0,119,0,11,0,25,38,54,1,26,39,9,1,32,40,39,0,121,40,4,0,1,10,0,0,0,55,38,0,119,0,4,0,0,9,39,0,0,54,38,0,119,0,237,255,33,41,10,0,1,65,0,0,125,42,41,55,65,0,0,0,139,42,0,0,140,3,54,0,0,0,0,0,1,47,0,0,136,50,0,0,0,48,50,0,136,50,0,0,1,51,224,0,3,50,50,51,137,50,0,0,130,50,0,0,136,51,0,0,49,50,50,51,16,83,0,0,135,50,0,0,25,39,48,120,25,42,48,80,0,41,48,0,1,50,136,0,3,40,48,50,0,46,42,0,25,49,46,40,1,50,0,0,85,46,50,0,25,46,46,4,54,50,46,49,44,83,0,0,82,45,2,0,85,39,45,0,1,50,0,0,134,5,0,0,0,0,0,0,50,1,39,41,42,0,0,0,34,6,5,0,121,6,3,0,1,4,255,255,119,0,94,0,25,17,0,76,82,28,17,0,1,50,255,255,15,33,50,28,121,33,6,0,134,34,0,0,228,142,0,0,0,0,0,0,0,31,34,0,119,0,2,0,1,31,0,0,82,35,0,0,38,50,35,32,0,36,50,0,25,37,0,74,78,38,37,0,41,50,38,24,42,50,50,24,34,7,50,1,121,7,4,0,38,50,35,223,0,8,50,0,85,0,8,0,25,9,0,48,82,10,9,0,32,11,10,0,121,11,46,0,25,13,0,44,82,14,13,0,85,13,40,0,25,15,0,28,85,15,40,0,25,16,0,20,85,16,40,0,1,50,80,0,85,9,50,0,25,18,40,80,25,19,0,16,85,19,18,0,134,20,0,0,0,0,0,0,0,1,39,41,42,0,0,0,1,50,0,0,13,21,14,50,121,21,3,0,0,43,20,0,119,0,30,0,25,22,0,36,82,23,22,0,38,51,23,7,1,52,0,0,1,53,0,0,135,50,8,0,51,0,52,53,82,24,16,0,1,50,0,0,13,25,24,50,1,50,255,255,125,3,25,50,20,0,0,0,85,13,14,0,1,50,0,0,85,9,50,0,1,50,0,0,85,19,50,0,1,50,0,0,85,15,50,0,1,50,0,0,85,16,50,0,0,43,3,0,119,0,6,0,134,12,0,0,0,0,0,0,0,1,39,41,42,0,0,0,0,43,12,0,82,26,0,0,38,50,26,32,0,27,50,0,32,29,27,0,1,50,255,255,125,44,29,43,50,0,0,0,20,50,26,36,0,30,50,0,85,0,30,0,32,32,31,0,120,32,4,0,134,50,0,0,204,142,0,0,0,0,0,0,0,4,44,0,137,48,0,0,139,4,0,0,140,6,79,0,0,0,0,0,2,76,0,0,255,0,0,0,1,74,0,0,136,77,0,0,0,75,77,0,136,77,0,0,25,77,77,32,137,77,0,0,130,77,0,0,136,78,0,0,49,77,77,78,36,85,0,0,135,77,0,0,0,6,0,0,0,7,1,0,0,18,2,0,0,29,3,0,0,40,4,0,0,51,5,0,0,62,40,0,0,73,62,0,0,69,73,0,19,77,69,76,0,70,77,0,0,71,29,0,27,77,70,3,3,8,71,77,0,72,8,0,0,9,73,0,19,77,9,76,0,10,77,0,0,11,51,0,19,77,11,76,0,12,77,0,15,13,10,12,120,13,2,0,119,0,81,0,0,14,72,0,78,15,14,0,19,77,15,76,0,16,77,0,0,17,7,0,78,19,17,0,19,77,19,76,0,20,77,0,13,21,16,20,121,21,29,0,0,22,72,0,25,23,22,2,78,24,23,0,19,77,24,76,0,25,77,0,0,26,6,0,78,27,26,0,38,77,27,3,0,28,77,0,19,77,28,76,0,30,77,0,14,31,25,30,121,31,16,0,0,32,72,0,1,77,0,0,83,32,77,0,0,33,6,0,25,34,33,16,82,35,34,0,0,36,6,0,0,37,7,0,0,38,29,0,0,39,72,0,0,41,18,0,38,78,35,7,135,77,9,0,78,36,37,38,39,41,0,0,0,42,72,0,78,43,42,0,19,77,43,76,0,44,77,0,1,77,251,0,17,45,44,77,121,45,26,0,0,46,72,0,25,47,46,2,78,48,47,0,19,77,48,76,0,49,77,0,0,50,6,0,78,52,50,0,38,77,52,3,0,53,77,0,19,77,53,76,0,54,77,0,14,55,49,54,121,55,13,0,0,56,6,0,78,57,56,0,38,77,57,3,0,58,77,0,19,77,58,76,0,59,77,0,26,60,59,1,19,77,60,76,0,61,77,0,0,63,72,0,25,64,63,2,83,64,61,0,0,65,73,0,25,77,65,1,41,77,77,24,42,77,77,24,0,66,77,0,0,73,66,0,0,67,72,0,25,68,67,3,0,72,68,0,119,0,168,255,137,75,0,0,139,0,0,0,140,3,48,0,0,0,0,0,1,44,0,0,136,46,0,0,0,45,46,0,25,8,2,16,82,9,8,0,1,46,0,0,13,20,9,46,121,20,12,0,134,35,0,0,172,134,0,0,2,0,0,0,32,36,35,0,121,36,5,0,82,6,8,0,0,40,6,0,1,44,5,0,119,0,6,0,1,3,0,0,119,0,4,0,0,31,9,0,0,40,31,0,1,44,5,0,32,46,44,5,121,46,68,0,25,37,2,20,82,38,37,0,4,39,40,38,16,10,39,1,0,11,38,0,121,10,8,0,25,12,2,36,82,13,12,0,38,46,13,7,135,14,8,0,46,2,0,1,0,3,14,0,119,0,55,0,25,15,2,75,78,16,15,0,1,46,255,255,41,47,16,24,42,47,47,24,15,17,46,47,121,17,37,0,0,41,1,0,32,18,41,0,121,18,6,0,0,4,1,0,0,5,0,0,0,30,11,0,1,43,0,0,119,0,33,0,26,19,41,1,3,21,0,19,78,22,21,0,41,47,22,24,42,47,47,24,32,23,47,10,121,23,3,0,0,42,41,0,119,0,3,0,0,41,19,0,119,0,239,255,25,24,2,36,82,25,24,0,38,47,25,7,135,26,8,0,47,2,0,42,16,27,26,42,121,27,3,0,0,3,42,0,119,0,20,0,3,28,0,42,4,29,1,42,82,7,37,0,0,4,29,0,0,5,28,0,0,30,7,0,0,43,42,0,119,0,5,0,0,4,1,0,0,5,0,0,0,30,11,0,1,43,0,0,135,47,10,0,30,5,4,0,82,32,37,0,3,33,32,4,85,37,33,0,3,34,43,4,0,3,34,0,139,3,0,0,140,3,56,0,0,0,0,0,2,53,0,0,255,0,0,0,2,54,0,0,128,0,0,0,1,51,0,0,136,55,0,0,0,52,55,0,1,55,0,0,13,4,0,55,121,4,3,0,1,3,1,0,119,0,120,0,35,5,1,128,121,5,6,0,19,55,1,53,0,16,55,0,83,0,16,0,1,3,1,0,119,0,113,0,1,55,0,8,16,27,1,55,121,27,19,0,43,55,1,6,0,38,55,0,1,55,192,0,20,55,38,55,0,45,55,0,19,55,45,53,0,46,55,0,25,47,0,1,83,0,46,0,38,55,1,63,0,48,55,0,20,55,48,54,0,49,55,0,19,55,49,53,0,6,55,0,83,47,6,0,1,3,2,0,119,0,92,0,2,55,0,0,0,216,0,0,16,7,1,55,1,55,0,224,19,55,1,55,0,8,55,0,2,55,0,0,0,224,0,0,13,9,8,55,20,55,7,9,0,50,55,0,121,50,29,0,43,55,1,12,0,10,55,0,1,55,224,0,20,55,10,55,0,11,55,0,19,55,11,53,0,12,55,0,25,13,0,1,83,0,12,0,43,55,1,6,0,14,55,0,38,55,14,63,0,15,55,0,20,55,15,54,0,17,55,0,19,55,17,53,0,18,55,0,25,19,0,2,83,13,18,0,38,55,1,63,0,20,55,0,20,55,20,54,0,21,55,0,19,55,21,53,0,22,55,0,83,19,22,0,1,3,3,0,119,0,52,0,2,55,0,0,0,0,1,0,4,23,1,55,2,55,0,0,0,0,16,0,16,24,23,55,121,24,39,0,43,55,1,18,0,25,55,0,1,55,240,0,20,55,25,55,0,26,55,0,19,55,26,53,0,28,55,0,25,29,0,1,83,0,28,0,43,55,1,12,0,30,55,0,38,55,30,63,0,31,55,0,20,55,31,54,0,32,55,0,19,55,32,53,0,33,55,0,25,34,0,2,83,29,33,0,43,55,1,6,0,35,55,0,38,55,35,63,0,36,55,0,20,55,36,54,0,37,55,0,19,55,37,53,0,39,55,0,25,40,0,3,83,34,39,0,38,55,1,63,0,41,55,0,20,55,41,54,0,42,55,0,19,55,42,53,0,43,55,0,83,40,43,0,1,3,4,0,119,0,7,0,134,44,0,0,220,140,0,0,1,55,84,0,85,44,55,0,1,3,255,255,119,0,1,0,139,3,0,0,140,4,57,0,0,0,0,0,1,52,0,0,136,54,0,0,0,53,54,0,136,54,0,0,25,54,54,32,137,54,0,0,130,54,0,0,136,55,0,0,49,54,54,55,144,90,0,0,135,54,0,0,25,16,53,12,0,51,53,0,0,4,0,0,0,5,1,0,85,16,2,0,0,27,3,0,0,38,4,0,78,45,38,0,38,54,45,3,0,46,54,0,25,54,46,1,41,54,54,24,42,54,54,24,0,47,54,0,78,48,38,0,38,54,47,3,0,49,54,0,38,54,48,252,0,6,54,0,20,54,6,49,0,7,54,0,83,38,7,0,0,8,5,0,1,54,248,0,13,50,8,54,121,50,28,0,0,9,4,0,25,10,9,8,82,11,10,0,0,12,4,0,25,13,12,12,85,13,11,0,0,14,4,0,25,15,14,8,2,54,0,0,255,255,255,127,85,15,54,0,0,17,4,0,25,18,17,12,82,19,18,0,82,20,16,0,82,21,20,0,17,22,19,21,121,22,10,0,82,23,16,0,82,24,23,0,0,25,4,0,25,26,25,12,82,28,26,0,4,29,24,28,0,30,4,0,25,31,30,4,85,31,29,0,0,32,5,0,1,54,255,0,19,54,32,54,0,33,54,0,83,51,33,0,25,34,51,4,85,34,16,0,0,35,4,0,0,36,27,0,0,37,4,0,25,39,37,24,82,40,39,0,1,55,0,0,1,56,1,0,134,54,0,0,232,84,0,0,35,51,36,40,55,56,0,0,0,41,5,0,1,54,248,0,13,42,41,54,120,42,3,0,137,53,0,0,139,0,0,0,0,43,4,0,25,44,43,4,1,54,0,0,85,44,54,0,137,53,0,0,139,0,0,0,140,5,45,0,0,0,0,0,1,40,0,0,136,42,0,0,0,41,42,0,136,42,0,0,25,42,42,32,137,42,0,0,130,42,0,0,136,43,0,0,49,42,42,43,16,92,0,0,135,42,0,0,0,39,41,0,0,5,0,0,0,6,1,0,0,17,2,0,0,28,3,0,0,31,4,0,0,32,28,0,25,33,32,1,78,34,33,0,0,38,34,0,0,35,38,0,41,42,35,24,42,42,42,24,0,36,42,0,1,42,1,0,1,43,2,0,138,36,42,43,104,92,0,0,112,92,0,0,137,41,0,0,139,0,0,0,119,0,5,0,1,40,4,0,119,0,3,0,1,40,2,0,119,0,1,0,32,42,40,4,121,42,22,0,0,19,6,0,25,20,19,4,82,21,20,0,0,37,21,0,0,22,5,0,0,23,37,0,82,24,23,0,82,25,24,0,0,26,17,0,25,27,26,4,1,42,0,0,134,29,0,0,64,93,0,0,22,25,42,27,33,30,29,0,121,30,6,0,1,43,133,0,134,42,0,0,64,140,0,0,43,39,0,0,1,40,2,0,32,42,40,2,121,42,10,0,0,7,5,0,0,8,17,0,25,9,8,4,2,43,0,0,144,208,3,0,1,44,0,0,134,42,0,0,64,93,0,0,7,43,9,44,0,10,28,0,1,42,248,255,83,10,42,0,0,11,28,0,25,12,11,1,1,42,1,0,83,12,42,0,0,13,5,0,78,14,13,0,38,42,14,3,0,15,42,0,0,16,28,0,25,18,16,2,83,18,15,0,137,41,0,0,139,0,0,0,140,4,50,0,0,0,0,0,1,46,0,0,136,48,0,0,0,47,48,0,136,48,0,0,25,48,48,32,137,48,0,0,130,48,0,0,136,49,0,0,49,48,48,49,116,93,0,0,135,48,0,0,0,4,0,0,0,5,1,0,0,16,2,0,0,27,3,0,1,44,0,0,0,38,16,0,1,48,0,0,14,39,38,48,121,39,11,0,0,40,5,0,0,41,4,0,25,42,41,4,82,43,42,0,4,6,40,43,0,45,6,0,0,7,45,0,0,8,16,0,85,8,7,0,119,0,24,0,0,9,27,0,82,10,9,0,0,45,10,0,0,11,45,0,0,12,4,0,25,13,12,12,82,14,13,0,15,15,14,11,120,15,7,0,0,17,45,0,0,18,5,0,15,19,18,17,120,19,3,0,1,44,1,0,119,0,9,0,0,20,5,0,0,21,27,0,82,22,21,0,4,23,22,20,85,21,23,0,0,24,27,0,82,25,24,0,0,45,25,0,0,26,44,0,33,28,26,0,121,28,4,0,0,37,44,0,137,47,0,0,139,37,0,0,0,29,4,0,25,30,29,8,82,31,30,0,0,32,45,0,15,33,32,31,120,33,4,0,0,37,44,0,137,47,0,0,139,37,0,0,0,34,45,0,0,35,4,0,25,36,35,8,85,36,34,0,0,37,44,0,137,47,0,0,139,37,0,0,140,3,43,0,0,0,0,0,2,40,0,0,255,0,0,0,1,38,0,0,136,41,0,0,0,39,41,0,1,41,0,0,16,19,41,1,1,41,255,255,16,30,41,0,32,31,1,0,19,41,31,30,0,32,41,0,20,41,19,32,0,33,41,0,121,33,45,0,0,5,2,0,0,34,0,0,0,35,1,0,1,41,10,0,1,42,0,0,134,36,0,0,124,139,0,0,34,35,41,42,128,42,0,0,0,9,42,0,39,42,36,48,0,10,42,0,19,42,10,40,0,11,42,0,26,12,5,1,83,12,11,0,1,42,10,0,1,41,0,0,134,13,0,0,20,142,0,0,34,35,42,41,128,41,0,0,0,14,41,0,1,41,9,0,16,15,41,35,1,41,255,255,16,16,41,34,32,17,35,9,19,41,17,16,0,18,41,0,20,41,15,18,0,20,41,0,121,20,5,0,0,5,12,0,0,34,13,0,0,35,14,0,119,0,223,255,0,8,12,0,0,28,13,0,0,29,14,0,119,0,1,0,0,3,8,0,0,4,28,0,119,0,3,0,0,3,2,0,0,4,0,0,32,21,4,0,121,21,3,0,0,6,3,0,119,0,22,0,0,7,3,0,0,37,4,0,31,41,37,10,38,41,41,255,0,22,41,0,39,41,22,48,0,23,41,0,19,41,23,40,0,24,41,0,26,25,7,1,83,25,24,0,29,41,37,10,38,41,41,255,0,26,41,0,35,27,37,10,121,27,3,0,0,6,25,0,119,0,4,0,0,7,25,0,0,37,26,0,119,0,238,255,139,6,0,0,140,5,36,0,0,0,0,0,2,31,0,0,0,1,0,0,2,32,0,0,255,0,0,0,2,33,0,0,0,255,255,255,1,29,0,0,136,34,0,0,0,30,34,0,136,34,0,0,3,34,34,31,137,34,0,0,130,34,0,0,136,35,0,0,49,34,34,35,36,96,0,0,135,34,0,0,0,28,30,0,2,34,0,0,0,32,1,0,19,34,4,34,0,8,34,0,32,9,8,0,15,19,3,2,19,34,19,9,0,27,34,0,121,27,46,0,4,20,2,3,16,21,31,20,125,22,21,31,20,0,0,0,135,34,2,0,28,1,22,0,16,23,32,20,82,24,0,0,38,34,24,32,0,25,34,0,32,26,25,0,121,23,28,0,4,10,2,3,0,6,20,0,0,17,24,0,0,18,26,0,121,18,7,0,134,34,0,0,204,86,0,0,28,31,0,0,82,7,0,0,0,14,7,0,119,0,2,0,0,14,17,0,4,11,6,31,16,12,32,11,38,34,14,32,0,13,34,0,32,15,13,0,121,12,5,0,0,6,11,0,0,17,14,0,0,18,15,0,119,0,239,255,19,34,10,32,0,16,34,0,121,15,9,0,0,5,16,0,119,0,4,0,121,26,6,0,0,5,20,0,119,0,1,0,134,34,0,0,204,86,0,0,28,5,0,0,137,30,0,0,139,0,0,0,140,1,23,0,0,0,0,0,1,20,0,0,136,22,0,0,0,21,22,0,1,14,0,0,1,22,125,2,3,3,22,14,78,6,3,0,1,22,255,0,19,22,6,22,0,7,22,0,13,8,7,0,121,8,4,0,0,15,14,0,1,20,2,0,119,0,10,0,25,9,14,1,32,10,9,87,121,10,5,0,1,16,87,0,1,18,213,2,1,20,5,0,119,0,3,0,0,14,9,0,119,0,237,255,32,22,20,2,121,22,8,0,32,2,15,0,121,2,3,0,1,17,213,2,119,0,4,0,0,16,15,0,1,18,213,2,1,20,5,0,32,22,20,5,121,22,22,0,1,20,0,0,0,19,18,0,78,11,19,0,41,22,11,24,42,22,22,24,32,12,22,0,25,13,19,1,121,12,3,0,0,1,13,0,119,0,3,0,0,19,13,0,119,0,247,255,26,4,16,1,32,5,4,0,121,5,3,0,0,17,1,0,119,0,5,0,0,16,4,0,0,18,1,0,1,20,5,0,119,0,236,255,139,17,0,0,140,2,23,0,0,0,0,0,1,19,0,0,136,21,0,0,0,20,21,0,127,21,0,0,87,21,0,0,127,21,0,0,82,4,21,0,127,21,0,0,106,5,21,4,1,21,52,0,135,10,3,0,4,5,21,0,128,21,0,0,0,11,21,0,1,21,255,7,19,21,10,21,0,12,21,0,1,21,0,0,1,22,0,8,138,12,21,22,152,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0], eb + 20480);
  HEAPU8.set([76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,76,130,0,0,228,130,0,0,1,21,254,3,4,6,12,21,85,1,6,0,2,21,0,0,255,255,15,128,19,21,5,21,0,7,21,0,2,21,0,0,0,0,224,63,20,21,7,21,0,8,21,0,127,21,0,0,85,21,4,0,127,21,0,0,109,21,4,8,127,21,0,0,86,9,21,0,58,2,9,0,119,0,22,0,59,21,0,0,70,13,0,21,121,13,12,0,61,21,0,0,0,0,128,95,65,14,0,21,134,15,0,0,244,97,0,0,14,1,0,0,82,16,1,0,26,17,16,64,58,3,15,0,0,18,17,0,119,0,3,0,58,3,0,0,1,18,0,0,85,1,18,0,58,2,3,0,119,0,3,0,58,2,0,0,119,0,1,0,139,2,0,0,140,3,20,0,0,0,0,0,1,16,0,0,136,18,0,0,0,17,18,0,136,18,0,0,25,18,18,32,137,18,0,0,130,18,0,0,136,19,0,0,49,18,18,19,36,131,0,0,135,18,0,0,0,11,17,0,25,10,17,20,25,4,0,60,82,5,4,0,85,11,5,0,25,12,11,4,1,18,0,0,85,12,18,0,25,13,11,8,85,13,1,0,25,14,11,12,85,14,10,0,25,15,11,16,85,15,2,0,1,18,140,0,135,6,11,0,18,11,0,0,134,7,0,0,152,140,0,0,6,0,0,0,34,8,7,0,121,8,5,0,1,18,255,255,85,10,18,0,1,9,255,255,119,0,3,0,82,3,10,0,0,9,3,0,137,17,0,0,139,9,0,0,140,1,33,0,0,0,0,0,1,24,0,0,136,26,0,0,0,25,26,0,136,26,0,0,25,26,26,16,137,26,0,0,130,26,0,0,136,27,0,0,49,26,26,27,208,131,0,0,135,26,0,0,0,1,0,0,0,2,1,0,78,13,2,0,38,26,13,252,0,17,26,0,83,2,17,0,0,18,1,0,25,19,18,4,1,26,0,0,85,19,26,0,0,20,1,0,25,21,20,8,2,26,0,0,255,255,255,127,85,21,26,0,0,22,1,0,25,23,22,12,2,26,0,0,255,255,255,127,85,23,26,0,0,3,1,0,25,4,3,16,1,26,4,0,85,4,26,0,0,5,1,0,25,6,5,24,82,7,6,0,1,27,1,0,1,28,2,0,1,29,0,0,1,30,0,0,1,31,0,0,1,32,0,0,134,26,0,0,160,136,0,0,7,27,28,29,30,31,32,0,0,8,1,0,25,9,8,24,82,10,9,0,1,26,251,255,83,10,26,0,0,11,1,0,25,12,11,24,82,14,12,0,25,15,14,2,1,26,0,0,83,15,26,0,0,16,1,0,1,32,251,0,1,31,0,0,134,26,0,0,24,139,0,0,16,32,31,0,137,25,0,0,139,0,0,0,140,4,20,0,0,0,0,0,136,15,0,0,0,14,15,0,136,15,0,0,25,15,15,16,137,15,0,0,0,4,14,0,42,15,1,31,34,17,1,0,1,18,255,255,1,19,0,0,125,16,17,18,19,0,0,0,41,16,16,1,20,15,15,16,0,5,15,0,34,16,1,0,1,19,255,255,1,18,0,0,125,15,16,19,18,0,0,0,42,15,15,31,34,19,1,0,1,16,255,255,1,17,0,0,125,18,19,16,17,0,0,0,41,18,18,1,20,15,15,18,0,6,15,0,42,15,3,31,34,17,3,0,1,16,255,255,1,19,0,0,125,18,17,16,19,0,0,0,41,18,18,1,20,15,15,18,0,7,15,0,34,18,3,0,1,19,255,255,1,16,0,0,125,15,18,19,16,0,0,0,42,15,15,31,34,19,3,0,1,18,255,255,1,17,0,0,125,16,19,18,17,0,0,0,41,16,16,1,20,15,15,16,0,8,15,0,21,15,5,0,21,16,6,1,134,9,0,0,188,141,0,0,15,16,5,6,128,16,0,0,0,10,16,0,21,16,7,2,21,15,8,3,134,11,0,0,188,141,0,0,16,15,7,8,128,16,0,0,134,15,0,0,32,72,0,0,9,10,11,16,4,0,0,0,82,15,4,0,21,15,15,5,106,16,4,4,21,16,16,6,134,12,0,0,188,141,0,0,15,16,5,6,128,16,0,0,0,13,16,0,137,14,0,0,129,13,0,0,139,12,0,0,140,3,21,0,0,0,0,0,1,17,0,0,136,19,0,0,0,18,19,0,136,19,0,0,25,19,19,80,137,19,0,0,130,19,0,0,136,20,0,0,49,19,19,20,48,134,0,0,135,19,0,0,0,14,18,0,25,13,18,12,25,3,0,36,1,19,6,0,85,3,19,0,82,4,0,0,38,19,4,64,0,5,19,0,32,6,5,0,121,6,17,0,25,7,0,60,82,8,7,0,85,14,8,0,25,15,14,4,1,19,1,84,85,15,19,0,25,16,14,8,85,16,13,0,1,19,54,0,135,9,12,0,19,14,0,0,32,10,9,0,120,10,4,0,25,11,0,75,1,19,255,255,83,11,19,0,134,12,0,0,224,77,0,0,0,1,2,0,137,18,0,0,139,12,0,0,140,1,26,0,0,0,0,0,1,23,0,0,136,25,0,0,0,24,25,0,25,2,0,74,78,3,2,0,41,25,3,24,42,25,25,24,0,14,25,0,1,25,255,0,3,16,14,25,20,25,16,14,0,17,25,0,1,25,255,0,19,25,17,25,0,18,25,0,83,2,18,0,82,19,0,0,38,25,19,8,0,20,25,0,32,21,20,0,121,21,21,0,25,4,0,8,1,25,0,0,85,4,25,0,25,5,0,4,1,25,0,0,85,5,25,0,25,6,0,44,82,7,6,0,25,8,0,28,85,8,7,0,25,9,0,20,85,9,7,0,0,10,7,0,25,11,0,48,82,12,11,0,3,13,10,12,25,15,0,16,85,15,13,0,1,1,0,0,119,0,5,0,39,25,19,32,0,22,25,0,85,0,22,0,1,1,255,255,139,1,0,0,140,4,20,0,0,0,0,0,42,15,1,31,34,17,1,0,1,18,255,255,1,19,0,0,125,16,17,18,19,0,0,0,41,16,16,1,20,15,15,16,0,4,15,0,34,16,1,0,1,19,255,255,1,18,0,0,125,15,16,19,18,0,0,0,42,15,15,31,34,19,1,0,1,16,255,255,1,17,0,0,125,18,19,16,17,0,0,0,41,18,18,1,20,15,15,18,0,5,15,0,42,15,3,31,34,17,3,0,1,16,255,255,1,19,0,0,125,18,17,16,19,0,0,0,41,18,18,1,20,15,15,18,0,6,15,0,34,18,3,0,1,19,255,255,1,16,0,0,125,15,18,19,16,0,0,0,42,15,15,31,34,19,3,0,1,18,255,255,1,17,0,0,125,16,19,18,17,0,0,0,41,16,16,1,20,15,15,16,0,7,15,0,21,15,4,0,21,16,5,1,134,8,0,0,188,141,0,0,15,16,4,5,128,16,0,0,0,9,16,0,21,16,6,2,21,15,7,3,134,10,0,0,188,141,0,0,16,15,6,7,21,15,6,4,0,11,15,0,21,15,7,5,0,12,15,0,128,15,0,0,1,16,0,0,134,13,0,0,32,72,0,0,8,9,10,15,16,0,0,0,21,16,13,11,128,15,0,0,21,15,15,12,134,14,0,0,188,141,0,0,16,15,11,12,139,14,0,0,140,7,25,0,0,0,0,0,1,21,0,0,136,23,0,0,0,22,23,0,136,23,0,0,25,23,23,32,137,23,0,0,130,23,0,0,136,24,0,0,49,23,23,24,212,136,0,0,135,23,0,0,0,7,0,0,0,8,1,0,0,13,2,0,0,14,3,0,0,15,4,0,0,16,5,0,0,17,6,0,0,18,7,0,0,19,8,0,27,20,19,3,1,24,0,0,135,23,2,0,18,24,20,0,0,9,13,0,1,23,255,0,19,23,9,23,0,10,23,0,0,11,7,0,25,12,11,1,83,12,10,0,137,22,0,0,139,0,0,0,140,4,11,0,0,0,0,0,0,4,0,0,0,5,2,0,134,6,0,0,32,138,0,0,4,5,0,0,128,9,0,0,0,7,9,0,5,8,1,5,5,9,3,4,3,9,9,8,3,9,9,7,38,10,7,0,20,9,9,10,129,9,0,0,38,9,6,255,39,9,9,0,139,9,0,0,140,0,6,0,0,0,0,0,1,1,0,0,136,3,0,0,0,2,3,0,1,3,76,12,1,4,0,0,83,3,4,0,1,4,76,12,1,3,0,0,107,4,1,3,1,3,76,12,1,4,0,0,107,3,2,4,1,4,76,12,1,3,0,0,107,4,3,3,1,3,76,12,1,4,0,0,107,3,4,4,1,4,76,12,1,3,0,0,107,4,5,3,1,3,76,12,1,4,0,0,107,3,6,4,1,4,76,12,1,3,0,0,107,4,7,3,1,3,40,10,1,4,76,12,85,3,4,0,1,4,36,10,1,3,5,0,85,4,3,0,1,3,36,10,82,0,3,0,38,4,0,7,1,5,16,10,135,3,13,0,4,5,0,0,139,0,0,0,140,2,11,0,0,0,0,0,2,9,0,0,255,255,0,0,19,9,0,9,0,2,9,0,2,9,0,0,255,255,0,0,19,9,1,9,0,3,9,0,5,4,3,2,43,9,0,16,0,5,9,0,43,9,4,16,5,10,3,5,3,6,9,10,43,10,1,16,0,7,10,0,5,8,7,2,43,10,6,16,5,9,7,5,3,10,10,9,2,9,0,0,255,255,0,0,19,9,6,9,3,9,9,8,43,9,9,16,3,10,10,9,129,10,0,0,3,10,6,8,41,10,10,16,2,9,0,0,255,255,0,0,19,9,4,9,20,10,10,9,39,10,10,0,139,10,0,0,140,1,10,0,0,0,0,0,1,6,0,0,136,8,0,0,0,7,8,0,136,8,0,0,25,8,8,16,137,8,0,0,130,8,0,0,136,9,0,0,49,8,8,9,232,138,0,0,135,8,0,0,0,5,7,0,25,1,0,60,82,2,1,0,85,5,2,0,1,8,6,0,135,3,14,0,8,5,0,0,134,4,0,0,152,140,0,0,3,0,0,0,137,7,0,0,139,4,0,0,140,3,13,0,0,0,0,0,1,9,0,0,136,11,0,0,0,10,11,0,136,11,0,0,25,11,11,16,137,11,0,0,130,11,0,0,136,12,0,0,49,11,11,12,76,139,0,0,135,11,0,0,0,3,0,0,0,4,1,0,0,5,2,0,0,6,3,0,0,7,4,0,0,8,5,0,1,12,0,0,134,11,0,0,92,90,0,0,6,7,8,12,137,10,0,0,139,0,0,0,140,4,7,0,0,0,0,0,136,6,0,0,0,5,6,0,136,6,0,0,25,6,6,16,137,6,0,0,0,4,5,0,134,6,0,0,32,72,0,0,0,1,2,3,4,0,0,0,137,5,0,0,106,6,4,4,129,6,0,0,82,6,4,0,139,6,0,0,140,1,5,0,0,0,0,0,130,2,1,0,1,3,255,0,19,3,0,3,90,1,2,3,34,2,1,8,121,2,2,0,139,1,0,0,130,2,1,0,42,3,0,8,1,4,255,0,19,3,3,4,90,1,2,3,34,2,1,8,121,2,3,0,25,2,1,8,139,2,0,0,130,2,1,0,42,3,0,16,1,4,255,0,19,3,3,4,90,1,2,3,34,2,1,8,121,2,3,0,25,2,1,16,139,2,0,0,130,2,1,0,43,3,0,24,90,2,2,3,25,2,2,24,139,2,0,0,140,2,9,0,0,0,0,0,1,5,0,0,136,7,0,0,0,6,7,0,136,7,0,0,25,7,7,16,137,7,0,0,130,7,0,0,136,8,0,0,49,7,7,8,116,140,0,0,135,7,0,0,0,4,6,0,85,4,1,0,1,7,8,0,82,2,7,0,134,3,0,0,216,82,0,0,2,0,4,0,137,6,0,0,139,3,0,0,140,1,8,0,0,0,0,0,1,5,0,0,136,7,0,0,0,6,7,0,1,7,0,240,16,2,7,0,121,2,8,0,1,7,0,0,4,3,7,0,134,4,0,0,220,140,0,0,85,4,3,0,1,1,255,255,119,0,2,0,0,1,0,0,139,1,0,0,140,0,9,0,0,0,0,0,1,5,0,0,136,7,0,0,0,6,7,0,1,7,0,0,1,8,0,0,13,1,7,8,121,1,3,0,1,0,88,10,119,0,5,0,135,2,15,0,25,3,2,64,82,4,3,0,0,0,4,0,139,0,0,0,140,2,8,0,0,0,0,0,1,5,0,0,136,7,0,0,0,6,7,0,1,7,0,0,13,3,0,7,121,3,3,0,1,2,0,0,119,0,6,0,1,7,0,0,134,4,0,0,68,88,0,0,0,1,7,0,0,2,4,0,139,2,0,0,140,0,6,0,0,0,0,0,1,1,0,0,136,3,0,0,0,2,3,0,136,3,0,0,25,3,3,16,137,3,0,0,130,3,0,0,136,4,0,0,49,3,3,4,144,141,0,0,135,3,0,0,0,0,2,0,2,3,0,0,160,134,1,0,85,0,3,0,1,4,16,10,1,5,248,0,134,3,0,0,24,139,0,0,4,5,0,0,137,2,0,0,139,0,0,0,140,4,8,0,0,0,0,0,4,4,0,2,4,5,1,3,4,6,1,3,16,7,0,2,4,5,6,7,129,5,0,0,139,4,0,0,140,1,7,0,0,0,0,0,1,4,0,0,136,6,0,0,0,5,6,0,25,1,0,68,82,2,1,0,32,3,2,0,121,3,4,0,134,6,0,0,204,142,0,0,0,0,0,0,139,0,0,0,140,4,6,0,0,0,0,0,1,5,0,0,134,4,0,0,32,72,0,0,0,1,2,3,5,0,0,0,139,4,0,0,140,4,8,0,0,0,0,0,3,4,0,2,3,6,1,3,16,7,4,0,3,5,6,7,129,5,0,0,139,4,0,0,140,2,2,0,0,0,0,0,137,0,0,0,132,0,0,1,139,0,0,0,140,2,6,0,0,0,0,0,1,3,0,0,136,5,0,0,0,4,5,0,134,2,0,0,244,97,0,0,0,1,0,0,139,2,0,0,140,5,7,0,0,0,0,0,1,6,2,0,135,5,16,0,6,0,0,0,139,0,0,0,140,0,4,0,0,0,0,0,1,0,0,0,136,2,0,0,0,1,2,0,1,3,0,0,135,2,17,0,3,0,0,0,1,2,0,0,139,2,0,0,140,1,4,0,0,0,0,0,1,1,0,0,136,3,0,0,0,2,3,0,139,0,0,0,140,1,4,0,0,0,0,0,1,1,0,0,136,3,0,0,0,2,3,0,1,3,0,0,139,3,0,0,140,3,5,0,0,0,0,0,1,4,1,0,135,3,18,0,4,0,0,0,1,3,0,0,139,3,0,0,140,1,3,0,0,0,0,0,1,2,0,0,135,1,19,0,2,0,0,0,1,1,0,0,139,1,0,0,140,1,3,0,0,0,0,0,1,2,3,0,135,1,20,0,2,0,0,0,139,0,0,0], eb + 30720);

  var relocations = [];
  relocations = relocations.concat([80,384,388,392,396,400,404,408,412,416,420,424,428,432,436,440,444,448,452,456,460,464,468,472,476,480,484,488,492,496,500,504,508,512,516,520,524,528,532,816,1968,2948,3124,3416,3480,3680,3684,3688,3692,3696,3700,3704,3708,3712,3716,3720,3724,3728,3732,3736,3740,3744,3748,3752,3756,3760,3764,3768,3772,3776,3780,3784,3788,3792,3796,3800,3804,3808,3812,3816,3820,3824,3828,3832,3836,3840,3844,3848,3852,3856,3860,3864,3868,3872,3876,3880,3884,3888,3892,3896,3900,5336,6724,7352,8016,8348,8520,8948,9312,9488,9720,11404,11476,11568,11684,11872,11948,12340,12716,13632,13636,13640,13644,13648,13652,13656,13660,15356,16908,16920,17300,17304,17308,17312,17316,17320,17324,17328,17332,17336,19988,21256,21308,21788,23176,23560,23636,23640,23916,24604,25164,25168,25172,25176,25180,25184,25188,25192,25196,25200,25204,25208,25212,25216,25220,25224,25228,25232,25236,25240,25244,25248,25252,25256,25260,25264,25268,25272,25276,25280,25284,25288,25292,25296,25300,25304,25308,25312,25316,25320,25324,25328,25332,25336,25340,25344,25348,25352,25356,25360,25364,25368,25372,25376,25380,25384,25388,25392,25396,25400,25404,25408,25412,25416,25420,25424,25428,25432,25436,25440,25444,25448,25452,25456,25460,25464,25468,25472,25476,25480,25484,25488,25492,25496,25500,25504,25508,25512,25516,25520,25524,25528,25532,25536,25540,25544,25548,25552,25556,25560,25564,25568,25572,25576,25580,25584,25588,25592,25596,25600,25604,25608,25612,25616,25620,25624,25628,25632,25636,25640,25644,25648,25652,25656,25660,25664,25668,25672,25676,25680,25684,25688,25692,25696,25700,25704,25708,25712,25716,25720,25724,25728,25732,25736,25740,25744,25748,25752,25756,25760,25764,25768,25772,25776,25780,25784,25788,25792,25796,25800,25804,25808,25812,25816,25820,25824,25828,25832,25836,25840,25844,25848,25852,25856,25860,25864,25868,25872,25876,25880,25884,25888,25892,25896,25900,25904,25908,25912,25916,25920,25924,25928,25932,25936,25940,25944,25948,25952,25956,25960,25964,25968,25972,25976,25980,25984,25988,25992,25996,26000,26004,26008,26012,26016,26020,26024,26028,26032,26036,26040,26044,26048,26052,26056,26060,26064,26068,26072,26076,26080,26084,26088,26092,26096,26100,26104,26108,26112,26116,26120,26124,26128,26132,26136,26140,26144,26148,26152,26156,26160,26164,26168,26172,26176,26180,26184,26188,26192,26196,26200,26204,26208,26212,26216,26220,26224,26228,26232,26236,26240,26244,26248,26252,26256,26260,26264,26268,26272,26276,26280,26284,26288,26292,26296,26300,26304,26308,26312,26316,26320,26324,26328,26332,26336,26340,26344,26348,26352,26356,26360,26364,26368,26372,26376,26380,26384,26388,26392,26396,26400,26404,26408,26412,26416,26420,26424,26428,26432,26436,26440,26444,26448,26452,26456,26460,26464,26468,26472,26476,26480,26484,26488,26492,26496,26500,26504,26508,26512,26516,26520,26524,26528,26532,26536,26540,26544,26548,26552,26556,26560,26564,26568,26572,26576,26580,26584,26588,26592,26596,26600,26604,26608,26612,26616,26620,26624,26628,26632,26636,26640,26644,26648,26652,26656,26660,26664,26668,26672,26676,26680,26684,26688,26692,26696,26700,26704,26708,26712,26716,26720,26724,26728,26732,26736,26740,26744,26748,26752,26756,26760,26764,26768,26772,26776,26780,26784,26788,26792,26796,26800,26804,26808,26812,26816,26820,26824,26828,26832,26836,26840,26844,26848,26852,26856,26860,26864,26868,26872,26876,26880,26884,26888,26892,26896,26900,26904,26908,26912,26916,26920,26924,26928,26932,26936,26940,26944,26948,26952,26956,26960,26964,26968,26972,26976,26980,26984,26988,26992,26996,27000,27004,27008,27012,27016,27020,27024,27028,27032,27036,27040,27044,27048,27052,27056,27060,27064,27068,27072,27076,27080,27084,27088,27092,27096,27100,27104,27108,27112,27116,27120,27124,27128,27132,27136,27140,27144,27148,27152,27156,27160,27164,27168,27172,27176,27180,27184,27188,27192,27196,27200,27204,27208,27212,27216,27220,27224,27228,27232,27236,27240,27244,27248,27252,27256,27260,27264,27268,27272,27276,27280,27284,27288,27292,27296,27300,27304,27308,27312,27316,27320,27324,27328,27332,27336,27340,27344,27348,27352,27356,27360,27364,27368,27372,27376,27380,27384,27388,27392,27396,27400,27404,27408,27412,27416,27420,27424,27428,27432,27436,27440,27444,27448,27452,27456,27460,27464,27468,27472,27476,27480,27484,27488,27492,27496,27500,27504,27508,27512,27516,27520,27524,27528,27532,27536,27540,27544,27548,27552,27556,27560,27564,27568,27572,27576,27580,27584,27588,27592,27596,27600,27604,27608,27612,27616,27620,27624,27628,27632,27636,27640,27644,27648,27652,27656,27660,27664,27668,27672,27676,27680,27684,27688,27692,27696,27700,27704,27708,27712,27716,27720,27724,27728,27732,27736,27740,27744,27748,27752,27756,27760,27764,27768,27772,27776,27780,27784,27788,27792,27796,27800,27804,27808,27812,27816,27820,27824,27828,27832,27836,27840,27844,27848,27852,27856,27860,27864,27868,27872,27876,27880,27884,27888,27892,27896,27900,27904,27908,27912,27916,27920,27924,27928,27932,27936,27940,27944,27948,27952,27956,27960,27964,27968,27972,27976,27980,27984,27988,27992,27996,28000,28004,28008,28012,28016,28020,28024,28028,28032,28036,28040,28044,28048,28052,28056,28060,28064,28068,28072,28076,28080,28084,28088,28092,28096,28100,28104,28108,28112,28116,28120,28124,28128,28132,28136,28140,28144,28148,28152,28156,28160,28164,28168,28172,28176,28180,28184,28188,28192,28196,28200,28204,28208,28212,28216,28220,28224,28228,28232,28236,28240,28244,28248,28252,28256,28260,28264,28268,28272,28276,28280,28284,28288,28292,28296,28300,28304,28308,28312,28316,28320,28324,28328,28332,28336,28340,28344,28348,28352,28356,28360,28364,28368,28372,28376,28380,28384,28388,28392,28396,28400,28404,28408,28412,28416,28420,28424,28428,28432,28436,28440,28444,28448,28452,28456,28460,28464,28468,28472,28476,28480,28484,28488,28492,28496,28500,28504,28508,28512,28516,28520,28524,28528,28532,28536,28540,28544,28548,28552,28556,28560,28564,28568,28572,28576,28580,28584,28588,28592,28596,28600,28604,28608,28612,28616,28620,28624,28628,28632,28636,28640,28644,28648,28652,28656,28660,28664,28668,28672,28676,28680,28684,28688,28692,28696,28700,28704,28708,28712,28716,28720,28724,28728,28732,28736,28740,28744,28748,28752,28756,28760,28764,28768,28772,28776,28780,28784,28788,28792,28796,28800,28804,28808,28812,28816,28820,28824,28828,28832,28836,28840,28844,28848,28852,28856,28860,28864,28868,28872,28876,28880,28884,28888,28892,28896,28900,28904,28908,28912,28916,28920,28924,28928,28932,28936,28940,28944,28948,28952,28956,28960,28964,28968,28972,28976,28980,28984,28988,28992,28996,29000,29004,29008,29012,29016,29020,29024,29028,29032,29036,29040,29044,29048,29052,29056,29060,29064,29068,29072,29076,29080,29084,29088,29092,29096,29100,29104,29108,29112,29116,29120,29124,29128,29132,29136,29140,29144,29148,29152,29156,29160,29164,29168,29172,29176,29180,29184,29188,29192,29196,29200,29204,29208,29212,29216,29220,29224,29228,29232,29236,29240,29244,29248,29252,29256,29260,29264,29268,29272,29276,29280,29284,29288,29292,29296,29300,29304,29308,29312,29316,29320,29324,29328,29332,29336,29340,29344,29348,29352,29356,29360,29364,29368,29372,29376,29380,29384,29388,29392,29396,29400,29404,29408,29412,29416,29420,29424,29428,29432,29436,29440,29444,29448,29452,29456,29460,29464,29468,29472,29476,29480,29484,29488,29492,29496,29500,29504,29508,29512,29516,29520,29524,29528,29532,29536,29540,29544,29548,29552,29556,29560,29564,29568,29572,29576,29580,29584,29588,29592,29596,29600,29604,29608,29612,29616,29620,29624,29628,29632,29636,29640,29644,29648,29652,29656,29660,29664,29668,29672,29676,29680,29684,29688,29692,29696,29700,29704,29708,29712,29716,29720,29724,29728,29732,29736,29740,29744,29748,29752,29756,29760,29764,29768,29772,29776,29780,29784,29788,29792,29796,29800,29804,29808,29812,29816,29820,29824,29828,29832,29836,29840,29844,29848,29852,29856,29860,29864,29868,29872,29876,29880,29884,29888,29892,29896,29900,29904,29908,29912,29916,29920,29924,29928,29932,29936,29940,29944,29948,29952,29956,29960,29964,29968,29972,29976,29980,29984,29988,29992,29996,30000,30004,30008,30012,30016,30020,30024,30028,30032,30036,30040,30044,30048,30052,30056,30060,30064,30068,30072,30076,30080,30084,30088,30092,30096,30100,30104,30108,30112,30116,30120,30124,30128,30132,30136,30140,30144,30148,30152,30156,30160,30164,30168,30172,30176,30180,30184,30188,30192,30196,30200,30204,30208,30212,30216,30220,30224,30228,30232,30236,30240,30244,30248,30252,30256,30260,30264,30268,30272,30276,30280,30284,30288,30292,30296,30300,30304,30308,30312,30316,30320,30324,30328,30332,30336,30340,30344,30348,30352,30356,30360,30364,30368,30372,30376,30380,30384,30388,30392,30396,30400,30404,30408,30412,30416,30420,30424,30428,30432,30436,30440,30444,30448,30452,30456,30460,30464,30468,30472,30476,30480,30484,30488,30492,30496,30500,30504,30508,30512,30516,30520,30524,30528,30532,30536,30540,30544,30548,30552,30556,30560,30564,30568,30572,30576,30580,30584,30588,30592,30596,30600,30604,30608,30612,30616,30620,30624,30628,30632,30636,30640,30644,30648,30652,30656,30660,30664,30668,30672,30676,30680,30684,30688,30692,30696,30700,30704,30708,30712,30716,30720,30724,30728,30732,30736,30740,30744,30748,30752,30756,30760,30764,30768,30772,30776,30780,30784,30788,30792,30796,30800,30804,30808,30812,30816,30820,30824,30828,30832,30836,30840,30844,30848,30852,30856,30860,30864,30868,30872,30876,30880,30884,30888,30892,30896,30900,30904,30908,30912,30916,30920,30924,30928,30932,30936,30940,30944,30948,30952,30956,30960,30964,30968,30972,30976,30980,30984,30988,30992,30996,31000,31004,31008,31012,31016,31020,31024,31028,31032,31036,31040,31044,31048,31052,31056,31060,31064,31068,31072,31076,31080,31084,31088,31092,31096,31100,31104,31108,31112,31116,31120,31124,31128,31132,31136,31140,31144,31148,31152,31156,31160,31164,31168,31172,31176,31180,31184,31188,31192,31196,31200,31204,31208,31212,31216,31220,31224,31228,31232,31236,31240,31244,31248,31252,31256,31260,31264,31268,31272,31276,31280,31284,31288,31292,31296,31300,31304,31308,31312,31316,31320,31324,31328,31332,31336,31340,31344,31348,31352,31356,31360,31364,31368,31372,31376,31380,31384,31388,31392,31396,31400,31404,31408,31412,31416,31420,31424,31428,31432,31436,31440,31444,31448,31452,31456,31460,31464,31468,31472,31476,31480,31484,31488,31492,31496,31500,31504,31508,31512,31516,31520,31524,31528,31532,31536,31540,31544,31548,31552,31556,31560,31564,31568,31572,31576,31580,31584,31588,31592,31596,31600,31604,31608,31612,31616,31620,31624,31628,31632,31636,31640,31644,31648,31652,31656,31660,31664,31668,31672,31676,31680,31684,31688,31692,31696,31700,31704,31708,31712,31716,31720,31724,31728,31732,31736,31740,31744,31748,31752,31756,31760,31764,31768,31772,31776,31780,31784,31788,31792,31796,31800,31804,31808,31812,31816,31820,31824,31828,31832,31836,31840,31844,31848,31852,31856,31860,31864,31868,31872,31876,31880,31884,31888,31892,31896,31900,31904,31908,31912,31916,31920,31924,31928,31932,31936,31940,31944,31948,31952,31956,31960,31964,31968,31972,31976,31980,31984,31988,31992,31996,32000,32004,32008,32012,32016,32020,32024,32028,32032,32036,32040,32044,32048,32052,32056,32060,32064,32068,32072,32076,32080,32084,32088,32092,32096,32100,32104,32108,32112,32116,32120,32124,32128,32132,32136,32140,32144,32148,32152,32156,32160,32164,32168,32172,32176,32180,32184,32188,32192,32196,32200,32204,32208,32212,32216,32220,32224,32228,32232,32236,32240,32244,32248,32252,32256,32260,32264,32268,32272,32276,32280,32284,32288,32292,32296,32300,32304,32308,32312,32316,32320,32324,32328,32332,32336,32340,32344,32348,32352,32356,32360,32364,32368,32372,32376,32380,32384,32388,32392,32396,32400,32404,32408,32412,32416,32420,32424,32428,32432,32436,32440,32444,32448,32452,32456,32460,32464,32468,32472,32476,32480,32484,32488,32492,32496,32500,32504,32508,32512,32516,32520,32524,32528,32532,32536,32540,32544,32548,32552,32556,32560,32564,32568,32572,32576,32580,32584,32588,32592,32596,32600,32604,32608,32612,32616,32620,32624,32628,32632,32636,32640,32644,32648,32652,32656,32660,32664,32668,32672,32676,32680,32684,32688,32692,32696,32700,32704,32708,32712,32716,32720,32724,32728,32732,32736,32740,32744,32748,32752,32756,32760,32764,32768,32772,32776,32780,32784,32788,32792,32796,32800,32804,32808,32812,32816,32820,32824,32828,32832,32836,32840,32844,32848,32852,32856,32860,32864,32868,32872,32876,32880,32884,32888,32892,32896,32900,32904,32908,32912,32916,32920,32924,32928,32932,32936,32940,32944,32948,32952,32956,32960,32964,32968,32972,32976,32980,32984,32988,32992,32996,33000,33004,33008,33012,33016,33020,33024,33028,33032,33036,33040,33044,33048,33052,33056,33060,33064,33068,33072,33076,33080,33084,33088,33092,33096,33100,33104,33108,33112,33116,33120,33124,33128,33132,33136,33140,33144,33148,33152,33156,33160,33164,33168,33172,33176,33180,33184,33188,33192,33196,33200,33204,33208,33212,33216,33220,33224,33228,33232,33236,33240,33244,33248,33252,33256,33260,33264,33268,33272,33276,33280,33284,33288,33292,33296,33300,33304,33308,33312,33316,33320,33324,33328,33332,33336,33340,33344,33348,33352,33564,33736,34344,35020,35552,35652,35948,36232,228,848,3444,4112,4324,4800,5300,5968,6016,6064,6124,6184,6240,6284,6936,6976,7028,10856,11180,11228,11268,11360,11656,11752,11844,12064,12204,12320,12464,12560,12852,12988,13060,13096,13292,13332,13396,13436,13576,13588,15188,15300,15560,15736,15864,15948,16060,16596,16644,16696,16732,16788,16836,17036,18772,19380,19504,19612,19736,20136,20200,21328,21380,21516,21648,21716,22264,23108,23456,23728,23752,23800,24272,24324,24724,24824,33460,33644,33880,33952,34196,34224,34240,34272,34460,34872,34900,34936,34964,35136,35592,35692,35744,35976,36036,36172,36268,36360,36388,36480]);

  for (var i = 0; i < relocations.length; i++) {
    assert(relocations[i] % 4 === 0);
    assert(relocations[i] >= 0 && relocations[i] < eb + 36688); // in range
    assert(HEAPU32[eb + relocations[i] >> 2] + eb < (-1 >>> 0), [i, relocations[i]]); // no overflows
    HEAPU32[eb + relocations[i] >> 2] = HEAPU32[eb + relocations[i] >> 2] + eb;
  }
});



   
  Module["_i64Subtract"] = _i64Subtract;

   
  Module["_i64Add"] = _i64Add;

   
  Module["_memset"] = _memset;

  function _pthread_cleanup_push(routine, arg) {
      __ATEXIT__.push(function() { Runtime.dynCall('vi', routine, [arg]) })
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

   
  Module["_bitshift64Shl"] = _bitshift64Shl;

  function _pthread_cleanup_pop() {
      assert(_pthread_cleanup_push.level == __ATEXIT__.length, 'cannot pop if something else added meanwhile!');
      __ATEXIT__.pop();
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function _abort() {
      Module['abort']();
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  var _emscripten_asm_const=true;

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else Module.printErr('failed to set errno from JS');
      return value;
    }
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _sysconf(name) {
      // long sysconf(int name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
      switch(name) {
        case 30: return PAGE_SIZE;
        case 85: return totalMemory / PAGE_SIZE;
        case 132:
        case 133:
        case 12:
        case 137:
        case 138:
        case 15:
        case 235:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 149:
        case 13:
        case 10:
        case 236:
        case 153:
        case 9:
        case 21:
        case 22:
        case 159:
        case 154:
        case 14:
        case 77:
        case 78:
        case 139:
        case 80:
        case 81:
        case 82:
        case 68:
        case 67:
        case 164:
        case 11:
        case 29:
        case 47:
        case 48:
        case 95:
        case 52:
        case 51:
        case 46:
          return 200809;
        case 79:
          return 0;
        case 27:
        case 246:
        case 127:
        case 128:
        case 23:
        case 24:
        case 160:
        case 161:
        case 181:
        case 182:
        case 242:
        case 183:
        case 184:
        case 243:
        case 244:
        case 245:
        case 165:
        case 178:
        case 179:
        case 49:
        case 50:
        case 168:
        case 169:
        case 175:
        case 170:
        case 171:
        case 172:
        case 97:
        case 76:
        case 32:
        case 173:
        case 35:
          return -1;
        case 176:
        case 177:
        case 7:
        case 155:
        case 8:
        case 157:
        case 125:
        case 126:
        case 92:
        case 93:
        case 129:
        case 130:
        case 131:
        case 94:
        case 91:
          return 1;
        case 74:
        case 60:
        case 69:
        case 70:
        case 4:
          return 1024;
        case 31:
        case 42:
        case 72:
          return 32;
        case 87:
        case 26:
        case 33:
          return 2147483647;
        case 34:
        case 1:
          return 47839;
        case 38:
        case 36:
          return 99;
        case 43:
        case 37:
          return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 28: return 32768;
        case 44: return 32767;
        case 75: return 16384;
        case 39: return 1000;
        case 89: return 700;
        case 71: return 256;
        case 40: return 255;
        case 2: return 100;
        case 180: return 64;
        case 25: return 20;
        case 5: return 16;
        case 6: return 6;
        case 73: return 4;
        case 84: {
          if (typeof navigator === 'object') return navigator['hardwareConcurrency'] || 1;
          return 1;
        }
      }
      ___setErrNo(ERRNO_CODES.EINVAL);
      return -1;
    }

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) {
        var success = self.alloc(bytes);
        if (!success) return -1 >>> 0; // sbrk failure code
      }
      return ret;  // Previous break location.
    }

  function _time(ptr) {
      var ret = (Date.now()/1000)|0;
      if (ptr) {
        HEAP32[((ptr)>>2)]=ret;
      }
      return ret;
    }

  function _pthread_self() {
      //FIXME: assumes only a single thread
      return 0;
    }

  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      var offset = offset_low;
      assert(offset_high === 0);
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
/* flush anything remaining in the buffer during shutdown */ __ATEXIT__.push(function() { var fflush = Module["_fflush"]; if (fflush) fflush(0); var printChar = ___syscall146.printChar; if (!printChar) return; var buffers = ___syscall146.buffers; if (buffers[1].length) printChar(1, 10); if (buffers[2].length) printChar(2, 10); });;
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

 var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_DYNAMIC);


function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vi(x) { Module["printErr"]("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "nullFunc_ii": nullFunc_ii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_vi": nullFunc_vi, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_viiiii": invoke_viiiii, "invoke_vi": invoke_vi, "_pthread_cleanup_pop": _pthread_cleanup_pop, "_pthread_self": _pthread_self, "_abort": _abort, "___setErrNo": ___setErrNo, "___syscall6": ___syscall6, "_sbrk": _sbrk, "_time": _time, "_pthread_cleanup_push": _pthread_cleanup_push, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___syscall54": ___syscall54, "___syscall140": ___syscall140, "_emscripten_asm_const_v": _emscripten_asm_const_v, "_sysconf": _sysconf, "___syscall146": ___syscall146, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8 };
Module.asmLibraryArg['EMTSTACKTOP'] = EMTSTACKTOP; Module.asmLibraryArg['EMT_STACK_MAX'] = EMT_STACK_MAX; Module.asmLibraryArg['eb'] = eb;
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'almost asm';
  
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;

  var tempRet0 = 0;
  var tempRet1 = 0;
  var tempRet2 = 0;
  var tempRet3 = 0;
  var tempRet4 = 0;
  var tempRet5 = 0;
  var tempRet6 = 0;
  var tempRet7 = 0;
  var tempRet8 = 0;
  var tempRet9 = 0;
  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_iiii=env.nullFunc_iiii;
  var nullFunc_viiiii=env.nullFunc_viiiii;
  var nullFunc_vi=env.nullFunc_vi;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_viiiii=env.invoke_viiiii;
  var invoke_vi=env.invoke_vi;
  var _pthread_cleanup_pop=env._pthread_cleanup_pop;
  var _pthread_self=env._pthread_self;
  var _abort=env._abort;
  var ___setErrNo=env.___setErrNo;
  var ___syscall6=env.___syscall6;
  var _sbrk=env._sbrk;
  var _time=env._time;
  var _pthread_cleanup_push=env._pthread_cleanup_push;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___syscall54=env.___syscall54;
  var ___syscall140=env.___syscall140;
  var _emscripten_asm_const_v=env._emscripten_asm_const_v;
  var _sysconf=env._sysconf;
  var ___syscall146=env.___syscall146;
  var tempFloat = 0.0;
  var asyncState = 0;

var EMTSTACKTOP = env.EMTSTACKTOP|0;
var EMT_STACK_MAX = env.EMT_STACK_MAX|0;
var eb = env.eb|0;
// EMSCRIPTEN_START_FUNCS

function _malloc($bytes) {
 $bytes = $bytes | 0;
 var $$0 = 0, $$lcssa = 0, $$lcssa141 = 0, $$lcssa142 = 0, $$lcssa144 = 0, $$lcssa147 = 0, $$lcssa149 = 0, $$lcssa151 = 0, $$lcssa153 = 0, $$lcssa155 = 0, $$lcssa157 = 0, $$not$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i13 = 0, $$pre$i16$i = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i14Z2D = 0, $$pre$phi$i17$iZ2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi10$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre71 = 0, $$pre9$i$i = 0, $$rsize$0$i = 0, $$rsize$4$i = 0, $$v$0$i = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $F$0$i$i = 0, $F1$0$i = 0, $F4$0 = 0, $F4$0$i$i = 0, $F5$0$i = 0, $I1$0$i$i = 0, $I7$0$i = 0, $I7$0$i$i = 0, $K12$0$i = 0, $K2$0$i$i = 0, $K8$0$i$i = 0, $R$1$i = 0, $R$1$i$i = 0, $R$1$i$i$lcssa = 0, $R$1$i$lcssa = 0, $R$1$i9 = 0, $R$1$i9$lcssa = 0, $R$3$i = 0, $R$3$i$i = 0, $R$3$i11 = 0, $RP$1$i = 0, $RP$1$i$i = 0, $RP$1$i$i$lcssa = 0, $RP$1$i$lcssa = 0, $RP$1$i8 = 0, $RP$1$i8$lcssa = 0, $T$0$i = 0, $T$0$i$i = 0, $T$0$i$i$lcssa = 0, $T$0$i$i$lcssa140 = 0, $T$0$i$lcssa = 0, $T$0$i$lcssa156 = 0, $T$0$i18$i = 0, $T$0$i18$i$lcssa = 0, $T$0$i18$i$lcssa139 = 0, $br$2$ph$i = 0, $cond$i = 0, $cond$i$i = 0, $cond$i12 = 0, $exitcond$i$i = 0, $i$01$i$i = 0, $idx$0$i = 0, $nb$0 = 0, $not$$i$i = 0, $not$$i20$i = 0, $not$7$i = 0, $oldfirst$0$i$i = 0, $or$cond$i = 0, $or$cond$i17 = 0, $or$cond1$i = 0, $or$cond1$i16 = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond2$i = 0, $or$cond48$i = 0, $or$cond5$i = 0, $or$cond7$i = 0, $or$cond8$i = 0, $p$0$i$i = 0, $qsize$0$i$i = 0, $rsize$0$i = 0, $rsize$0$i$lcssa = 0, $rsize$0$i5 = 0, $rsize$1$i = 0, $rsize$3$i = 0, $rsize$4$lcssa$i = 0, $rsize$412$i = 0, $rst$0$i = 0, $rst$1$i = 0, $sizebits$0$$i = 0, $sizebits$0$i = 0, $sp$0$i$i = 0, $sp$0$i$i$i = 0, $sp$068$i = 0, $sp$068$i$lcssa = 0, $sp$167$i = 0, $sp$167$i$lcssa = 0, $ssize$0$i = 0, $ssize$2$ph$i = 0, $ssize$5$i = 0, $t$0$i = 0, $t$0$i4 = 0, $t$2$i = 0, $t$4$ph$i = 0, $t$4$v$4$i = 0, $t$411$i = 0, $tbase$746$i = 0, $tsize$745$i = 0, $v$0$i = 0, $v$0$i$lcssa = 0, $v$0$i6 = 0, $v$1$i = 0, $v$3$i = 0, $v$4$lcssa$i = 0, $v$413$i = 0, label = 0, sp = 0;
 label = 0;
 sp = STACKTOP;
 $0 = $bytes >>> 0 < 245;
 asyncState ? abort(-12) | 0 : 0;
 do {
  if ($0) {
   $1 = $bytes >>> 0 < 11;
   $2 = $bytes + 11 | 0;
   $3 = $2 & -8;
   $4 = $1 ? 16 : $3;
   $5 = $4 >>> 3;
   $6 = HEAP32[663] | 0;
   $7 = $6 >>> $5;
   $8 = $7 & 3;
   $9 = ($8 | 0) == 0;
   if (!$9) {
    $10 = $7 & 1;
    $11 = $10 ^ 1;
    $12 = $11 + $5 | 0;
    $13 = $12 << 1;
    $14 = 2692 + ($13 << 2) | 0;
    $15 = $14 + 8 | 0;
    $16 = HEAP32[$15 >> 2] | 0;
    $17 = $16 + 8 | 0;
    $18 = HEAP32[$17 >> 2] | 0;
    $19 = ($14 | 0) == ($18 | 0);
    do {
     if ($19) {
      $20 = 1 << $12;
      $21 = $20 ^ -1;
      $22 = $6 & $21;
      HEAP32[663] = $22;
     } else {
      $23 = HEAP32[2668 >> 2] | 0;
      $24 = $18 >>> 0 < $23 >>> 0;
      if ($24) {
       _abort(), asyncState ? abort(-12) | 0 : 0;
      }
      $25 = $18 + 12 | 0;
      $26 = HEAP32[$25 >> 2] | 0;
      $27 = ($26 | 0) == ($16 | 0);
      if ($27) {
       HEAP32[$25 >> 2] = $14;
       HEAP32[$15 >> 2] = $18;
       break;
      } else {
       _abort(), asyncState ? abort(-12) | 0 : 0;
      }
     }
    } while (0);
    $28 = $12 << 3;
    $29 = $28 | 3;
    $30 = $16 + 4 | 0;
    HEAP32[$30 >> 2] = $29;
    $31 = $16 + $28 | 0;
    $32 = $31 + 4 | 0;
    $33 = HEAP32[$32 >> 2] | 0;
    $34 = $33 | 1;
    HEAP32[$32 >> 2] = $34;
    $$0 = $17;
    return $$0 | 0;
   }
   $35 = HEAP32[2660 >> 2] | 0;
   $36 = $4 >>> 0 > $35 >>> 0;
   if ($36) {
    $37 = ($7 | 0) == 0;
    if (!$37) {
     $38 = $7 << $5;
     $39 = 2 << $5;
     $40 = 0 - $39 | 0;
     $41 = $39 | $40;
     $42 = $38 & $41;
     $43 = 0 - $42 | 0;
     $44 = $42 & $43;
     $45 = $44 + -1 | 0;
     $46 = $45 >>> 12;
     $47 = $46 & 16;
     $48 = $45 >>> $47;
     $49 = $48 >>> 5;
     $50 = $49 & 8;
     $51 = $50 | $47;
     $52 = $48 >>> $50;
     $53 = $52 >>> 2;
     $54 = $53 & 4;
     $55 = $51 | $54;
     $56 = $52 >>> $54;
     $57 = $56 >>> 1;
     $58 = $57 & 2;
     $59 = $55 | $58;
     $60 = $56 >>> $58;
     $61 = $60 >>> 1;
     $62 = $61 & 1;
     $63 = $59 | $62;
     $64 = $60 >>> $62;
     $65 = $63 + $64 | 0;
     $66 = $65 << 1;
     $67 = 2692 + ($66 << 2) | 0;
     $68 = $67 + 8 | 0;
     $69 = HEAP32[$68 >> 2] | 0;
     $70 = $69 + 8 | 0;
     $71 = HEAP32[$70 >> 2] | 0;
     $72 = ($67 | 0) == ($71 | 0);
     do {
      if ($72) {
       $73 = 1 << $65;
       $74 = $73 ^ -1;
       $75 = $6 & $74;
       HEAP32[663] = $75;
       $89 = $35;
      } else {
       $76 = HEAP32[2668 >> 2] | 0;
       $77 = $71 >>> 0 < $76 >>> 0;
       if ($77) {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       }
       $78 = $71 + 12 | 0;
       $79 = HEAP32[$78 >> 2] | 0;
       $80 = ($79 | 0) == ($69 | 0);
       if ($80) {
        HEAP32[$78 >> 2] = $67;
        HEAP32[$68 >> 2] = $71;
        $$pre = HEAP32[2660 >> 2] | 0;
        $89 = $$pre;
        break;
       } else {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       }
      }
     } while (0);
     $81 = $65 << 3;
     $82 = $81 - $4 | 0;
     $83 = $4 | 3;
     $84 = $69 + 4 | 0;
     HEAP32[$84 >> 2] = $83;
     $85 = $69 + $4 | 0;
     $86 = $82 | 1;
     $87 = $85 + 4 | 0;
     HEAP32[$87 >> 2] = $86;
     $88 = $85 + $82 | 0;
     HEAP32[$88 >> 2] = $82;
     $90 = ($89 | 0) == 0;
     if (!$90) {
      $91 = HEAP32[2672 >> 2] | 0;
      $92 = $89 >>> 3;
      $93 = $92 << 1;
      $94 = 2692 + ($93 << 2) | 0;
      $95 = HEAP32[663] | 0;
      $96 = 1 << $92;
      $97 = $95 & $96;
      $98 = ($97 | 0) == 0;
      if ($98) {
       $99 = $95 | $96;
       HEAP32[663] = $99;
       $$pre71 = $94 + 8 | 0;
       $$pre$phiZ2D = $$pre71;
       $F4$0 = $94;
      } else {
       $100 = $94 + 8 | 0;
       $101 = HEAP32[$100 >> 2] | 0;
       $102 = HEAP32[2668 >> 2] | 0;
       $103 = $101 >>> 0 < $102 >>> 0;
       if ($103) {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       } else {
        $$pre$phiZ2D = $100;
        $F4$0 = $101;
       }
      }
      HEAP32[$$pre$phiZ2D >> 2] = $91;
      $104 = $F4$0 + 12 | 0;
      HEAP32[$104 >> 2] = $91;
      $105 = $91 + 8 | 0;
      HEAP32[$105 >> 2] = $F4$0;
      $106 = $91 + 12 | 0;
      HEAP32[$106 >> 2] = $94;
     }
     HEAP32[2660 >> 2] = $82;
     HEAP32[2672 >> 2] = $85;
     $$0 = $70;
     return $$0 | 0;
    }
    $107 = HEAP32[2656 >> 2] | 0;
    $108 = ($107 | 0) == 0;
    if ($108) {
     $nb$0 = $4;
    } else {
     $109 = 0 - $107 | 0;
     $110 = $107 & $109;
     $111 = $110 + -1 | 0;
     $112 = $111 >>> 12;
     $113 = $112 & 16;
     $114 = $111 >>> $113;
     $115 = $114 >>> 5;
     $116 = $115 & 8;
     $117 = $116 | $113;
     $118 = $114 >>> $116;
     $119 = $118 >>> 2;
     $120 = $119 & 4;
     $121 = $117 | $120;
     $122 = $118 >>> $120;
     $123 = $122 >>> 1;
     $124 = $123 & 2;
     $125 = $121 | $124;
     $126 = $122 >>> $124;
     $127 = $126 >>> 1;
     $128 = $127 & 1;
     $129 = $125 | $128;
     $130 = $126 >>> $128;
     $131 = $129 + $130 | 0;
     $132 = 2956 + ($131 << 2) | 0;
     $133 = HEAP32[$132 >> 2] | 0;
     $134 = $133 + 4 | 0;
     $135 = HEAP32[$134 >> 2] | 0;
     $136 = $135 & -8;
     $137 = $136 - $4 | 0;
     $rsize$0$i = $137;
     $t$0$i = $133;
     $v$0$i = $133;
     while (1) {
      $138 = $t$0$i + 16 | 0;
      $139 = HEAP32[$138 >> 2] | 0;
      $140 = ($139 | 0) == (0 | 0);
      if ($140) {
       $141 = $t$0$i + 20 | 0;
       $142 = HEAP32[$141 >> 2] | 0;
       $143 = ($142 | 0) == (0 | 0);
       if ($143) {
        $rsize$0$i$lcssa = $rsize$0$i;
        $v$0$i$lcssa = $v$0$i;
        break;
       } else {
        $145 = $142;
       }
      } else {
       $145 = $139;
      }
      $144 = $145 + 4 | 0;
      $146 = HEAP32[$144 >> 2] | 0;
      $147 = $146 & -8;
      $148 = $147 - $4 | 0;
      $149 = $148 >>> 0 < $rsize$0$i >>> 0;
      $$rsize$0$i = $149 ? $148 : $rsize$0$i;
      $$v$0$i = $149 ? $145 : $v$0$i;
      $rsize$0$i = $$rsize$0$i;
      $t$0$i = $145;
      $v$0$i = $$v$0$i;
     }
     $150 = HEAP32[2668 >> 2] | 0;
     $151 = $v$0$i$lcssa >>> 0 < $150 >>> 0;
     if ($151) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
     $152 = $v$0$i$lcssa + $4 | 0;
     $153 = $v$0$i$lcssa >>> 0 < $152 >>> 0;
     if (!$153) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
     $154 = $v$0$i$lcssa + 24 | 0;
     $155 = HEAP32[$154 >> 2] | 0;
     $156 = $v$0$i$lcssa + 12 | 0;
     $157 = HEAP32[$156 >> 2] | 0;
     $158 = ($157 | 0) == ($v$0$i$lcssa | 0);
     do {
      if ($158) {
       $168 = $v$0$i$lcssa + 20 | 0;
       $169 = HEAP32[$168 >> 2] | 0;
       $170 = ($169 | 0) == (0 | 0);
       if ($170) {
        $171 = $v$0$i$lcssa + 16 | 0;
        $172 = HEAP32[$171 >> 2] | 0;
        $173 = ($172 | 0) == (0 | 0);
        if ($173) {
         $R$3$i = 0;
         break;
        } else {
         $R$1$i = $172;
         $RP$1$i = $171;
        }
       } else {
        $R$1$i = $169;
        $RP$1$i = $168;
       }
       while (1) {
        $174 = $R$1$i + 20 | 0;
        $175 = HEAP32[$174 >> 2] | 0;
        $176 = ($175 | 0) == (0 | 0);
        if (!$176) {
         $R$1$i = $175;
         $RP$1$i = $174;
         continue;
        }
        $177 = $R$1$i + 16 | 0;
        $178 = HEAP32[$177 >> 2] | 0;
        $179 = ($178 | 0) == (0 | 0);
        if ($179) {
         $R$1$i$lcssa = $R$1$i;
         $RP$1$i$lcssa = $RP$1$i;
         break;
        } else {
         $R$1$i = $178;
         $RP$1$i = $177;
        }
       }
       $180 = $RP$1$i$lcssa >>> 0 < $150 >>> 0;
       if ($180) {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       } else {
        HEAP32[$RP$1$i$lcssa >> 2] = 0;
        $R$3$i = $R$1$i$lcssa;
        break;
       }
      } else {
       $159 = $v$0$i$lcssa + 8 | 0;
       $160 = HEAP32[$159 >> 2] | 0;
       $161 = $160 >>> 0 < $150 >>> 0;
       if ($161) {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       }
       $162 = $160 + 12 | 0;
       $163 = HEAP32[$162 >> 2] | 0;
       $164 = ($163 | 0) == ($v$0$i$lcssa | 0);
       if (!$164) {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       }
       $165 = $157 + 8 | 0;
       $166 = HEAP32[$165 >> 2] | 0;
       $167 = ($166 | 0) == ($v$0$i$lcssa | 0);
       if ($167) {
        HEAP32[$162 >> 2] = $157;
        HEAP32[$165 >> 2] = $160;
        $R$3$i = $157;
        break;
       } else {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       }
      }
     } while (0);
     $181 = ($155 | 0) == (0 | 0);
     do {
      if (!$181) {
       $182 = $v$0$i$lcssa + 28 | 0;
       $183 = HEAP32[$182 >> 2] | 0;
       $184 = 2956 + ($183 << 2) | 0;
       $185 = HEAP32[$184 >> 2] | 0;
       $186 = ($v$0$i$lcssa | 0) == ($185 | 0);
       if ($186) {
        HEAP32[$184 >> 2] = $R$3$i;
        $cond$i = ($R$3$i | 0) == (0 | 0);
        if ($cond$i) {
         $187 = 1 << $183;
         $188 = $187 ^ -1;
         $189 = HEAP32[2656 >> 2] | 0;
         $190 = $189 & $188;
         HEAP32[2656 >> 2] = $190;
         break;
        }
       } else {
        $191 = HEAP32[2668 >> 2] | 0;
        $192 = $155 >>> 0 < $191 >>> 0;
        if ($192) {
         _abort(), asyncState ? abort(-12) | 0 : 0;
        }
        $193 = $155 + 16 | 0;
        $194 = HEAP32[$193 >> 2] | 0;
        $195 = ($194 | 0) == ($v$0$i$lcssa | 0);
        if ($195) {
         HEAP32[$193 >> 2] = $R$3$i;
        } else {
         $196 = $155 + 20 | 0;
         HEAP32[$196 >> 2] = $R$3$i;
        }
        $197 = ($R$3$i | 0) == (0 | 0);
        if ($197) {
         break;
        }
       }
       $198 = HEAP32[2668 >> 2] | 0;
       $199 = $R$3$i >>> 0 < $198 >>> 0;
       if ($199) {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       }
       $200 = $R$3$i + 24 | 0;
       HEAP32[$200 >> 2] = $155;
       $201 = $v$0$i$lcssa + 16 | 0;
       $202 = HEAP32[$201 >> 2] | 0;
       $203 = ($202 | 0) == (0 | 0);
       do {
        if (!$203) {
         $204 = $202 >>> 0 < $198 >>> 0;
         if ($204) {
          _abort(), asyncState ? abort(-12) | 0 : 0;
         } else {
          $205 = $R$3$i + 16 | 0;
          HEAP32[$205 >> 2] = $202;
          $206 = $202 + 24 | 0;
          HEAP32[$206 >> 2] = $R$3$i;
          break;
         }
        }
       } while (0);
       $207 = $v$0$i$lcssa + 20 | 0;
       $208 = HEAP32[$207 >> 2] | 0;
       $209 = ($208 | 0) == (0 | 0);
       if (!$209) {
        $210 = HEAP32[2668 >> 2] | 0;
        $211 = $208 >>> 0 < $210 >>> 0;
        if ($211) {
         _abort(), asyncState ? abort(-12) | 0 : 0;
        } else {
         $212 = $R$3$i + 20 | 0;
         HEAP32[$212 >> 2] = $208;
         $213 = $208 + 24 | 0;
         HEAP32[$213 >> 2] = $R$3$i;
         break;
        }
       }
      }
     } while (0);
     $214 = $rsize$0$i$lcssa >>> 0 < 16;
     if ($214) {
      $215 = $rsize$0$i$lcssa + $4 | 0;
      $216 = $215 | 3;
      $217 = $v$0$i$lcssa + 4 | 0;
      HEAP32[$217 >> 2] = $216;
      $218 = $v$0$i$lcssa + $215 | 0;
      $219 = $218 + 4 | 0;
      $220 = HEAP32[$219 >> 2] | 0;
      $221 = $220 | 1;
      HEAP32[$219 >> 2] = $221;
     } else {
      $222 = $4 | 3;
      $223 = $v$0$i$lcssa + 4 | 0;
      HEAP32[$223 >> 2] = $222;
      $224 = $rsize$0$i$lcssa | 1;
      $225 = $152 + 4 | 0;
      HEAP32[$225 >> 2] = $224;
      $226 = $152 + $rsize$0$i$lcssa | 0;
      HEAP32[$226 >> 2] = $rsize$0$i$lcssa;
      $227 = HEAP32[2660 >> 2] | 0;
      $228 = ($227 | 0) == 0;
      if (!$228) {
       $229 = HEAP32[2672 >> 2] | 0;
       $230 = $227 >>> 3;
       $231 = $230 << 1;
       $232 = 2692 + ($231 << 2) | 0;
       $233 = HEAP32[663] | 0;
       $234 = 1 << $230;
       $235 = $233 & $234;
       $236 = ($235 | 0) == 0;
       if ($236) {
        $237 = $233 | $234;
        HEAP32[663] = $237;
        $$pre$i = $232 + 8 | 0;
        $$pre$phi$iZ2D = $$pre$i;
        $F1$0$i = $232;
       } else {
        $238 = $232 + 8 | 0;
        $239 = HEAP32[$238 >> 2] | 0;
        $240 = HEAP32[2668 >> 2] | 0;
        $241 = $239 >>> 0 < $240 >>> 0;
        if ($241) {
         _abort(), asyncState ? abort(-12) | 0 : 0;
        } else {
         $$pre$phi$iZ2D = $238;
         $F1$0$i = $239;
        }
       }
       HEAP32[$$pre$phi$iZ2D >> 2] = $229;
       $242 = $F1$0$i + 12 | 0;
       HEAP32[$242 >> 2] = $229;
       $243 = $229 + 8 | 0;
       HEAP32[$243 >> 2] = $F1$0$i;
       $244 = $229 + 12 | 0;
       HEAP32[$244 >> 2] = $232;
      }
      HEAP32[2660 >> 2] = $rsize$0$i$lcssa;
      HEAP32[2672 >> 2] = $152;
     }
     $245 = $v$0$i$lcssa + 8 | 0;
     $$0 = $245;
     return $$0 | 0;
    }
   } else {
    $nb$0 = $4;
   }
  } else {
   $246 = $bytes >>> 0 > 4294967231;
   if ($246) {
    $nb$0 = -1;
   } else {
    $247 = $bytes + 11 | 0;
    $248 = $247 & -8;
    $249 = HEAP32[2656 >> 2] | 0;
    $250 = ($249 | 0) == 0;
    if ($250) {
     $nb$0 = $248;
    } else {
     $251 = 0 - $248 | 0;
     $252 = $247 >>> 8;
     $253 = ($252 | 0) == 0;
     if ($253) {
      $idx$0$i = 0;
     } else {
      $254 = $248 >>> 0 > 16777215;
      if ($254) {
       $idx$0$i = 31;
      } else {
       $255 = $252 + 1048320 | 0;
       $256 = $255 >>> 16;
       $257 = $256 & 8;
       $258 = $252 << $257;
       $259 = $258 + 520192 | 0;
       $260 = $259 >>> 16;
       $261 = $260 & 4;
       $262 = $261 | $257;
       $263 = $258 << $261;
       $264 = $263 + 245760 | 0;
       $265 = $264 >>> 16;
       $266 = $265 & 2;
       $267 = $262 | $266;
       $268 = 14 - $267 | 0;
       $269 = $263 << $266;
       $270 = $269 >>> 15;
       $271 = $268 + $270 | 0;
       $272 = $271 << 1;
       $273 = $271 + 7 | 0;
       $274 = $248 >>> $273;
       $275 = $274 & 1;
       $276 = $275 | $272;
       $idx$0$i = $276;
      }
     }
     $277 = 2956 + ($idx$0$i << 2) | 0;
     $278 = HEAP32[$277 >> 2] | 0;
     $279 = ($278 | 0) == (0 | 0);
     L123 : do {
      if ($279) {
       $rsize$3$i = $251;
       $t$2$i = 0;
       $v$3$i = 0;
       label = 86;
      } else {
       $280 = ($idx$0$i | 0) == 31;
       $281 = $idx$0$i >>> 1;
       $282 = 25 - $281 | 0;
       $283 = $280 ? 0 : $282;
       $284 = $248 << $283;
       $rsize$0$i5 = $251;
       $rst$0$i = 0;
       $sizebits$0$i = $284;
       $t$0$i4 = $278;
       $v$0$i6 = 0;
       while (1) {
        $285 = $t$0$i4 + 4 | 0;
        $286 = HEAP32[$285 >> 2] | 0;
        $287 = $286 & -8;
        $288 = $287 - $248 | 0;
        $289 = $288 >>> 0 < $rsize$0$i5 >>> 0;
        if ($289) {
         $290 = ($287 | 0) == ($248 | 0);
         if ($290) {
          $rsize$412$i = $288;
          $t$411$i = $t$0$i4;
          $v$413$i = $t$0$i4;
          label = 90;
          break L123;
         } else {
          $rsize$1$i = $288;
          $v$1$i = $t$0$i4;
         }
        } else {
         $rsize$1$i = $rsize$0$i5;
         $v$1$i = $v$0$i6;
        }
        $291 = $t$0$i4 + 20 | 0;
        $292 = HEAP32[$291 >> 2] | 0;
        $293 = $sizebits$0$i >>> 31;
        $294 = ($t$0$i4 + 16 | 0) + ($293 << 2) | 0;
        $295 = HEAP32[$294 >> 2] | 0;
        $296 = ($292 | 0) == (0 | 0);
        $297 = ($292 | 0) == ($295 | 0);
        $or$cond1$i = $296 | $297;
        $rst$1$i = $or$cond1$i ? $rst$0$i : $292;
        $298 = ($295 | 0) == (0 | 0);
        $299 = $298 & 1;
        $300 = $299 ^ 1;
        $sizebits$0$$i = $sizebits$0$i << $300;
        if ($298) {
         $rsize$3$i = $rsize$1$i;
         $t$2$i = $rst$1$i;
         $v$3$i = $v$1$i;
         label = 86;
         break;
        } else {
         $rsize$0$i5 = $rsize$1$i;
         $rst$0$i = $rst$1$i;
         $sizebits$0$i = $sizebits$0$$i;
         $t$0$i4 = $295;
         $v$0$i6 = $v$1$i;
        }
       }
      }
     } while (0);
     if ((label | 0) == 86) {
      $301 = ($t$2$i | 0) == (0 | 0);
      $302 = ($v$3$i | 0) == (0 | 0);
      $or$cond$i = $301 & $302;
      if ($or$cond$i) {
       $303 = 2 << $idx$0$i;
       $304 = 0 - $303 | 0;
       $305 = $303 | $304;
       $306 = $249 & $305;
       $307 = ($306 | 0) == 0;
       if ($307) {
        $nb$0 = $248;
        break;
       }
       $308 = 0 - $306 | 0;
       $309 = $306 & $308;
       $310 = $309 + -1 | 0;
       $311 = $310 >>> 12;
       $312 = $311 & 16;
       $313 = $310 >>> $312;
       $314 = $313 >>> 5;
       $315 = $314 & 8;
       $316 = $315 | $312;
       $317 = $313 >>> $315;
       $318 = $317 >>> 2;
       $319 = $318 & 4;
       $320 = $316 | $319;
       $321 = $317 >>> $319;
       $322 = $321 >>> 1;
       $323 = $322 & 2;
       $324 = $320 | $323;
       $325 = $321 >>> $323;
       $326 = $325 >>> 1;
       $327 = $326 & 1;
       $328 = $324 | $327;
       $329 = $325 >>> $327;
       $330 = $328 + $329 | 0;
       $331 = 2956 + ($330 << 2) | 0;
       $332 = HEAP32[$331 >> 2] | 0;
       $t$4$ph$i = $332;
      } else {
       $t$4$ph$i = $t$2$i;
      }
      $333 = ($t$4$ph$i | 0) == (0 | 0);
      if ($333) {
       $rsize$4$lcssa$i = $rsize$3$i;
       $v$4$lcssa$i = $v$3$i;
      } else {
       $rsize$412$i = $rsize$3$i;
       $t$411$i = $t$4$ph$i;
       $v$413$i = $v$3$i;
       label = 90;
      }
     }
     if ((label | 0) == 90) {
      while (1) {
       label = 0;
       $334 = $t$411$i + 4 | 0;
       $335 = HEAP32[$334 >> 2] | 0;
       $336 = $335 & -8;
       $337 = $336 - $248 | 0;
       $338 = $337 >>> 0 < $rsize$412$i >>> 0;
       $$rsize$4$i = $338 ? $337 : $rsize$412$i;
       $t$4$v$4$i = $338 ? $t$411$i : $v$413$i;
       $339 = $t$411$i + 16 | 0;
       $340 = HEAP32[$339 >> 2] | 0;
       $341 = ($340 | 0) == (0 | 0);
       if (!$341) {
        $rsize$412$i = $$rsize$4$i;
        $t$411$i = $340;
        $v$413$i = $t$4$v$4$i;
        label = 90;
        continue;
       }
       $342 = $t$411$i + 20 | 0;
       $343 = HEAP32[$342 >> 2] | 0;
       $344 = ($343 | 0) == (0 | 0);
       if ($344) {
        $rsize$4$lcssa$i = $$rsize$4$i;
        $v$4$lcssa$i = $t$4$v$4$i;
        break;
       } else {
        $rsize$412$i = $$rsize$4$i;
        $t$411$i = $343;
        $v$413$i = $t$4$v$4$i;
        label = 90;
       }
      }
     }
     $345 = ($v$4$lcssa$i | 0) == (0 | 0);
     if ($345) {
      $nb$0 = $248;
     } else {
      $346 = HEAP32[2660 >> 2] | 0;
      $347 = $346 - $248 | 0;
      $348 = $rsize$4$lcssa$i >>> 0 < $347 >>> 0;
      if ($348) {
       $349 = HEAP32[2668 >> 2] | 0;
       $350 = $v$4$lcssa$i >>> 0 < $349 >>> 0;
       if ($350) {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       }
       $351 = $v$4$lcssa$i + $248 | 0;
       $352 = $v$4$lcssa$i >>> 0 < $351 >>> 0;
       if (!$352) {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       }
       $353 = $v$4$lcssa$i + 24 | 0;
       $354 = HEAP32[$353 >> 2] | 0;
       $355 = $v$4$lcssa$i + 12 | 0;
       $356 = HEAP32[$355 >> 2] | 0;
       $357 = ($356 | 0) == ($v$4$lcssa$i | 0);
       do {
        if ($357) {
         $367 = $v$4$lcssa$i + 20 | 0;
         $368 = HEAP32[$367 >> 2] | 0;
         $369 = ($368 | 0) == (0 | 0);
         if ($369) {
          $370 = $v$4$lcssa$i + 16 | 0;
          $371 = HEAP32[$370 >> 2] | 0;
          $372 = ($371 | 0) == (0 | 0);
          if ($372) {
           $R$3$i11 = 0;
           break;
          } else {
           $R$1$i9 = $371;
           $RP$1$i8 = $370;
          }
         } else {
          $R$1$i9 = $368;
          $RP$1$i8 = $367;
         }
         while (1) {
          $373 = $R$1$i9 + 20 | 0;
          $374 = HEAP32[$373 >> 2] | 0;
          $375 = ($374 | 0) == (0 | 0);
          if (!$375) {
           $R$1$i9 = $374;
           $RP$1$i8 = $373;
           continue;
          }
          $376 = $R$1$i9 + 16 | 0;
          $377 = HEAP32[$376 >> 2] | 0;
          $378 = ($377 | 0) == (0 | 0);
          if ($378) {
           $R$1$i9$lcssa = $R$1$i9;
           $RP$1$i8$lcssa = $RP$1$i8;
           break;
          } else {
           $R$1$i9 = $377;
           $RP$1$i8 = $376;
          }
         }
         $379 = $RP$1$i8$lcssa >>> 0 < $349 >>> 0;
         if ($379) {
          _abort(), asyncState ? abort(-12) | 0 : 0;
         } else {
          HEAP32[$RP$1$i8$lcssa >> 2] = 0;
          $R$3$i11 = $R$1$i9$lcssa;
          break;
         }
        } else {
         $358 = $v$4$lcssa$i + 8 | 0;
         $359 = HEAP32[$358 >> 2] | 0;
         $360 = $359 >>> 0 < $349 >>> 0;
         if ($360) {
          _abort(), asyncState ? abort(-12) | 0 : 0;
         }
         $361 = $359 + 12 | 0;
         $362 = HEAP32[$361 >> 2] | 0;
         $363 = ($362 | 0) == ($v$4$lcssa$i | 0);
         if (!$363) {
          _abort(), asyncState ? abort(-12) | 0 : 0;
         }
         $364 = $356 + 8 | 0;
         $365 = HEAP32[$364 >> 2] | 0;
         $366 = ($365 | 0) == ($v$4$lcssa$i | 0);
         if ($366) {
          HEAP32[$361 >> 2] = $356;
          HEAP32[$364 >> 2] = $359;
          $R$3$i11 = $356;
          break;
         } else {
          _abort(), asyncState ? abort(-12) | 0 : 0;
         }
        }
       } while (0);
       $380 = ($354 | 0) == (0 | 0);
       do {
        if (!$380) {
         $381 = $v$4$lcssa$i + 28 | 0;
         $382 = HEAP32[$381 >> 2] | 0;
         $383 = 2956 + ($382 << 2) | 0;
         $384 = HEAP32[$383 >> 2] | 0;
         $385 = ($v$4$lcssa$i | 0) == ($384 | 0);
         if ($385) {
          HEAP32[$383 >> 2] = $R$3$i11;
          $cond$i12 = ($R$3$i11 | 0) == (0 | 0);
          if ($cond$i12) {
           $386 = 1 << $382;
           $387 = $386 ^ -1;
           $388 = HEAP32[2656 >> 2] | 0;
           $389 = $388 & $387;
           HEAP32[2656 >> 2] = $389;
           break;
          }
         } else {
          $390 = HEAP32[2668 >> 2] | 0;
          $391 = $354 >>> 0 < $390 >>> 0;
          if ($391) {
           _abort(), asyncState ? abort(-12) | 0 : 0;
          }
          $392 = $354 + 16 | 0;
          $393 = HEAP32[$392 >> 2] | 0;
          $394 = ($393 | 0) == ($v$4$lcssa$i | 0);
          if ($394) {
           HEAP32[$392 >> 2] = $R$3$i11;
          } else {
           $395 = $354 + 20 | 0;
           HEAP32[$395 >> 2] = $R$3$i11;
          }
          $396 = ($R$3$i11 | 0) == (0 | 0);
          if ($396) {
           break;
          }
         }
         $397 = HEAP32[2668 >> 2] | 0;
         $398 = $R$3$i11 >>> 0 < $397 >>> 0;
         if ($398) {
          _abort(), asyncState ? abort(-12) | 0 : 0;
         }
         $399 = $R$3$i11 + 24 | 0;
         HEAP32[$399 >> 2] = $354;
         $400 = $v$4$lcssa$i + 16 | 0;
         $401 = HEAP32[$400 >> 2] | 0;
         $402 = ($401 | 0) == (0 | 0);
         do {
          if (!$402) {
           $403 = $401 >>> 0 < $397 >>> 0;
           if ($403) {
            _abort(), asyncState ? abort(-12) | 0 : 0;
           } else {
            $404 = $R$3$i11 + 16 | 0;
            HEAP32[$404 >> 2] = $401;
            $405 = $401 + 24 | 0;
            HEAP32[$405 >> 2] = $R$3$i11;
            break;
           }
          }
         } while (0);
         $406 = $v$4$lcssa$i + 20 | 0;
         $407 = HEAP32[$406 >> 2] | 0;
         $408 = ($407 | 0) == (0 | 0);
         if (!$408) {
          $409 = HEAP32[2668 >> 2] | 0;
          $410 = $407 >>> 0 < $409 >>> 0;
          if ($410) {
           _abort(), asyncState ? abort(-12) | 0 : 0;
          } else {
           $411 = $R$3$i11 + 20 | 0;
           HEAP32[$411 >> 2] = $407;
           $412 = $407 + 24 | 0;
           HEAP32[$412 >> 2] = $R$3$i11;
           break;
          }
         }
        }
       } while (0);
       $413 = $rsize$4$lcssa$i >>> 0 < 16;
       do {
        if ($413) {
         $414 = $rsize$4$lcssa$i + $248 | 0;
         $415 = $414 | 3;
         $416 = $v$4$lcssa$i + 4 | 0;
         HEAP32[$416 >> 2] = $415;
         $417 = $v$4$lcssa$i + $414 | 0;
         $418 = $417 + 4 | 0;
         $419 = HEAP32[$418 >> 2] | 0;
         $420 = $419 | 1;
         HEAP32[$418 >> 2] = $420;
        } else {
         $421 = $248 | 3;
         $422 = $v$4$lcssa$i + 4 | 0;
         HEAP32[$422 >> 2] = $421;
         $423 = $rsize$4$lcssa$i | 1;
         $424 = $351 + 4 | 0;
         HEAP32[$424 >> 2] = $423;
         $425 = $351 + $rsize$4$lcssa$i | 0;
         HEAP32[$425 >> 2] = $rsize$4$lcssa$i;
         $426 = $rsize$4$lcssa$i >>> 3;
         $427 = $rsize$4$lcssa$i >>> 0 < 256;
         if ($427) {
          $428 = $426 << 1;
          $429 = 2692 + ($428 << 2) | 0;
          $430 = HEAP32[663] | 0;
          $431 = 1 << $426;
          $432 = $430 & $431;
          $433 = ($432 | 0) == 0;
          if ($433) {
           $434 = $430 | $431;
           HEAP32[663] = $434;
           $$pre$i13 = $429 + 8 | 0;
           $$pre$phi$i14Z2D = $$pre$i13;
           $F5$0$i = $429;
          } else {
           $435 = $429 + 8 | 0;
           $436 = HEAP32[$435 >> 2] | 0;
           $437 = HEAP32[2668 >> 2] | 0;
           $438 = $436 >>> 0 < $437 >>> 0;
           if ($438) {
            _abort(), asyncState ? abort(-12) | 0 : 0;
           } else {
            $$pre$phi$i14Z2D = $435;
            $F5$0$i = $436;
           }
          }
          HEAP32[$$pre$phi$i14Z2D >> 2] = $351;
          $439 = $F5$0$i + 12 | 0;
          HEAP32[$439 >> 2] = $351;
          $440 = $351 + 8 | 0;
          HEAP32[$440 >> 2] = $F5$0$i;
          $441 = $351 + 12 | 0;
          HEAP32[$441 >> 2] = $429;
          break;
         }
         $442 = $rsize$4$lcssa$i >>> 8;
         $443 = ($442 | 0) == 0;
         if ($443) {
          $I7$0$i = 0;
         } else {
          $444 = $rsize$4$lcssa$i >>> 0 > 16777215;
          if ($444) {
           $I7$0$i = 31;
          } else {
           $445 = $442 + 1048320 | 0;
           $446 = $445 >>> 16;
           $447 = $446 & 8;
           $448 = $442 << $447;
           $449 = $448 + 520192 | 0;
           $450 = $449 >>> 16;
           $451 = $450 & 4;
           $452 = $451 | $447;
           $453 = $448 << $451;
           $454 = $453 + 245760 | 0;
           $455 = $454 >>> 16;
           $456 = $455 & 2;
           $457 = $452 | $456;
           $458 = 14 - $457 | 0;
           $459 = $453 << $456;
           $460 = $459 >>> 15;
           $461 = $458 + $460 | 0;
           $462 = $461 << 1;
           $463 = $461 + 7 | 0;
           $464 = $rsize$4$lcssa$i >>> $463;
           $465 = $464 & 1;
           $466 = $465 | $462;
           $I7$0$i = $466;
          }
         }
         $467 = 2956 + ($I7$0$i << 2) | 0;
         $468 = $351 + 28 | 0;
         HEAP32[$468 >> 2] = $I7$0$i;
         $469 = $351 + 16 | 0;
         $470 = $469 + 4 | 0;
         HEAP32[$470 >> 2] = 0;
         HEAP32[$469 >> 2] = 0;
         $471 = HEAP32[2656 >> 2] | 0;
         $472 = 1 << $I7$0$i;
         $473 = $471 & $472;
         $474 = ($473 | 0) == 0;
         if ($474) {
          $475 = $471 | $472;
          HEAP32[2656 >> 2] = $475;
          HEAP32[$467 >> 2] = $351;
          $476 = $351 + 24 | 0;
          HEAP32[$476 >> 2] = $467;
          $477 = $351 + 12 | 0;
          HEAP32[$477 >> 2] = $351;
          $478 = $351 + 8 | 0;
          HEAP32[$478 >> 2] = $351;
          break;
         }
         $479 = HEAP32[$467 >> 2] | 0;
         $480 = ($I7$0$i | 0) == 31;
         $481 = $I7$0$i >>> 1;
         $482 = 25 - $481 | 0;
         $483 = $480 ? 0 : $482;
         $484 = $rsize$4$lcssa$i << $483;
         $K12$0$i = $484;
         $T$0$i = $479;
         while (1) {
          $485 = $T$0$i + 4 | 0;
          $486 = HEAP32[$485 >> 2] | 0;
          $487 = $486 & -8;
          $488 = ($487 | 0) == ($rsize$4$lcssa$i | 0);
          if ($488) {
           $T$0$i$lcssa = $T$0$i;
           label = 148;
           break;
          }
          $489 = $K12$0$i >>> 31;
          $490 = ($T$0$i + 16 | 0) + ($489 << 2) | 0;
          $491 = $K12$0$i << 1;
          $492 = HEAP32[$490 >> 2] | 0;
          $493 = ($492 | 0) == (0 | 0);
          if ($493) {
           $$lcssa157 = $490;
           $T$0$i$lcssa156 = $T$0$i;
           label = 145;
           break;
          } else {
           $K12$0$i = $491;
           $T$0$i = $492;
          }
         }
         if ((label | 0) == 145) {
          $494 = HEAP32[2668 >> 2] | 0;
          $495 = $$lcssa157 >>> 0 < $494 >>> 0;
          if ($495) {
           _abort(), asyncState ? abort(-12) | 0 : 0;
          } else {
           HEAP32[$$lcssa157 >> 2] = $351;
           $496 = $351 + 24 | 0;
           HEAP32[$496 >> 2] = $T$0$i$lcssa156;
           $497 = $351 + 12 | 0;
           HEAP32[$497 >> 2] = $351;
           $498 = $351 + 8 | 0;
           HEAP32[$498 >> 2] = $351;
           break;
          }
         } else if ((label | 0) == 148) {
          $499 = $T$0$i$lcssa + 8 | 0;
          $500 = HEAP32[$499 >> 2] | 0;
          $501 = HEAP32[2668 >> 2] | 0;
          $502 = $500 >>> 0 >= $501 >>> 0;
          $not$7$i = $T$0$i$lcssa >>> 0 >= $501 >>> 0;
          $503 = $502 & $not$7$i;
          if ($503) {
           $504 = $500 + 12 | 0;
           HEAP32[$504 >> 2] = $351;
           HEAP32[$499 >> 2] = $351;
           $505 = $351 + 8 | 0;
           HEAP32[$505 >> 2] = $500;
           $506 = $351 + 12 | 0;
           HEAP32[$506 >> 2] = $T$0$i$lcssa;
           $507 = $351 + 24 | 0;
           HEAP32[$507 >> 2] = 0;
           break;
          } else {
           _abort(), asyncState ? abort(-12) | 0 : 0;
          }
         }
        }
       } while (0);
       $508 = $v$4$lcssa$i + 8 | 0;
       $$0 = $508;
       return $$0 | 0;
      } else {
       $nb$0 = $248;
      }
     }
    }
   }
  }
 } while (0);
 $509 = HEAP32[2660 >> 2] | 0;
 $510 = $509 >>> 0 < $nb$0 >>> 0;
 if (!$510) {
  $511 = $509 - $nb$0 | 0;
  $512 = HEAP32[2672 >> 2] | 0;
  $513 = $511 >>> 0 > 15;
  if ($513) {
   $514 = $512 + $nb$0 | 0;
   HEAP32[2672 >> 2] = $514;
   HEAP32[2660 >> 2] = $511;
   $515 = $511 | 1;
   $516 = $514 + 4 | 0;
   HEAP32[$516 >> 2] = $515;
   $517 = $514 + $511 | 0;
   HEAP32[$517 >> 2] = $511;
   $518 = $nb$0 | 3;
   $519 = $512 + 4 | 0;
   HEAP32[$519 >> 2] = $518;
  } else {
   HEAP32[2660 >> 2] = 0;
   HEAP32[2672 >> 2] = 0;
   $520 = $509 | 3;
   $521 = $512 + 4 | 0;
   HEAP32[$521 >> 2] = $520;
   $522 = $512 + $509 | 0;
   $523 = $522 + 4 | 0;
   $524 = HEAP32[$523 >> 2] | 0;
   $525 = $524 | 1;
   HEAP32[$523 >> 2] = $525;
  }
  $526 = $512 + 8 | 0;
  $$0 = $526;
  return $$0 | 0;
 }
 $527 = HEAP32[2664 >> 2] | 0;
 $528 = $527 >>> 0 > $nb$0 >>> 0;
 if ($528) {
  $529 = $527 - $nb$0 | 0;
  HEAP32[2664 >> 2] = $529;
  $530 = HEAP32[2676 >> 2] | 0;
  $531 = $530 + $nb$0 | 0;
  HEAP32[2676 >> 2] = $531;
  $532 = $529 | 1;
  $533 = $531 + 4 | 0;
  HEAP32[$533 >> 2] = $532;
  $534 = $nb$0 | 3;
  $535 = $530 + 4 | 0;
  HEAP32[$535 >> 2] = $534;
  $536 = $530 + 8 | 0;
  $$0 = $536;
  return $$0 | 0;
 }
 $537 = HEAP32[781] | 0;
 $538 = ($537 | 0) == 0;
 do {
  if ($538) {
   $539 = (tempInt = _sysconf(30) | 0, asyncState ? abort(-12) | 0 : tempInt) | 0;
   $540 = $539 + -1 | 0;
   $541 = $540 & $539;
   $542 = ($541 | 0) == 0;
   if ($542) {
    HEAP32[3132 >> 2] = $539;
    HEAP32[3128 >> 2] = $539;
    HEAP32[3136 >> 2] = -1;
    HEAP32[3140 >> 2] = -1;
    HEAP32[3144 >> 2] = 0;
    HEAP32[3096 >> 2] = 0;
    $543 = (tempInt = _time(0 | 0) | 0, asyncState ? abort(-12) | 0 : tempInt) | 0;
    $544 = $543 & -16;
    $545 = $544 ^ 1431655768;
    HEAP32[781] = $545;
    break;
   } else {
    _abort(), asyncState ? abort(-12) | 0 : 0;
   }
  }
 } while (0);
 $546 = $nb$0 + 48 | 0;
 $547 = HEAP32[3132 >> 2] | 0;
 $548 = $nb$0 + 47 | 0;
 $549 = $547 + $548 | 0;
 $550 = 0 - $547 | 0;
 $551 = $549 & $550;
 $552 = $551 >>> 0 > $nb$0 >>> 0;
 if (!$552) {
  $$0 = 0;
  return $$0 | 0;
 }
 $553 = HEAP32[3092 >> 2] | 0;
 $554 = ($553 | 0) == 0;
 if (!$554) {
  $555 = HEAP32[3084 >> 2] | 0;
  $556 = $555 + $551 | 0;
  $557 = $556 >>> 0 <= $555 >>> 0;
  $558 = $556 >>> 0 > $553 >>> 0;
  $or$cond1$i16 = $557 | $558;
  if ($or$cond1$i16) {
   $$0 = 0;
   return $$0 | 0;
  }
 }
 $559 = HEAP32[3096 >> 2] | 0;
 $560 = $559 & 4;
 $561 = ($560 | 0) == 0;
 L257 : do {
  if ($561) {
   $562 = HEAP32[2676 >> 2] | 0;
   $563 = ($562 | 0) == (0 | 0);
   L259 : do {
    if ($563) {
     label = 173;
    } else {
     $sp$0$i$i = 3100;
     while (1) {
      $564 = HEAP32[$sp$0$i$i >> 2] | 0;
      $565 = $564 >>> 0 > $562 >>> 0;
      if (!$565) {
       $566 = $sp$0$i$i + 4 | 0;
       $567 = HEAP32[$566 >> 2] | 0;
       $568 = $564 + $567 | 0;
       $569 = $568 >>> 0 > $562 >>> 0;
       if ($569) {
        $$lcssa153 = $sp$0$i$i;
        $$lcssa155 = $566;
        break;
       }
      }
      $570 = $sp$0$i$i + 8 | 0;
      $571 = HEAP32[$570 >> 2] | 0;
      $572 = ($571 | 0) == (0 | 0);
      if ($572) {
       label = 173;
       break L259;
      } else {
       $sp$0$i$i = $571;
      }
     }
     $595 = HEAP32[2664 >> 2] | 0;
     $596 = $549 - $595 | 0;
     $597 = $596 & $550;
     $598 = $597 >>> 0 < 2147483647;
     if ($598) {
      $599 = (tempInt = _sbrk($597 | 0) | 0, asyncState ? abort(-12) | 0 : tempInt) | 0;
      $600 = HEAP32[$$lcssa153 >> 2] | 0;
      $601 = HEAP32[$$lcssa155 >> 2] | 0;
      $602 = $600 + $601 | 0;
      $603 = ($599 | 0) == ($602 | 0);
      if ($603) {
       $604 = ($599 | 0) == (-1 | 0);
       if (!$604) {
        $tbase$746$i = $599;
        $tsize$745$i = $597;
        label = 193;
        break L257;
       }
      } else {
       $br$2$ph$i = $599;
       $ssize$2$ph$i = $597;
       label = 183;
      }
     }
    }
   } while (0);
   do {
    if ((label | 0) == 173) {
     $573 = (tempInt = _sbrk(0) | 0, asyncState ? abort(-12) | 0 : tempInt) | 0;
     $574 = ($573 | 0) == (-1 | 0);
     if (!$574) {
      $575 = $573;
      $576 = HEAP32[3128 >> 2] | 0;
      $577 = $576 + -1 | 0;
      $578 = $577 & $575;
      $579 = ($578 | 0) == 0;
      if ($579) {
       $ssize$0$i = $551;
      } else {
       $580 = $577 + $575 | 0;
       $581 = 0 - $576 | 0;
       $582 = $580 & $581;
       $583 = $551 - $575 | 0;
       $584 = $583 + $582 | 0;
       $ssize$0$i = $584;
      }
      $585 = HEAP32[3084 >> 2] | 0;
      $586 = $585 + $ssize$0$i | 0;
      $587 = $ssize$0$i >>> 0 > $nb$0 >>> 0;
      $588 = $ssize$0$i >>> 0 < 2147483647;
      $or$cond$i17 = $587 & $588;
      if ($or$cond$i17) {
       $589 = HEAP32[3092 >> 2] | 0;
       $590 = ($589 | 0) == 0;
       if (!$590) {
        $591 = $586 >>> 0 <= $585 >>> 0;
        $592 = $586 >>> 0 > $589 >>> 0;
        $or$cond2$i = $591 | $592;
        if ($or$cond2$i) {
         break;
        }
       }
       $593 = (tempInt = _sbrk($ssize$0$i | 0) | 0, asyncState ? abort(-12) | 0 : tempInt) | 0;
       $594 = ($593 | 0) == ($573 | 0);
       if ($594) {
        $tbase$746$i = $573;
        $tsize$745$i = $ssize$0$i;
        label = 193;
        break L257;
       } else {
        $br$2$ph$i = $593;
        $ssize$2$ph$i = $ssize$0$i;
        label = 183;
       }
      }
     }
    }
   } while (0);
   L279 : do {
    if ((label | 0) == 183) {
     $605 = 0 - $ssize$2$ph$i | 0;
     $606 = ($br$2$ph$i | 0) != (-1 | 0);
     $607 = $ssize$2$ph$i >>> 0 < 2147483647;
     $or$cond7$i = $607 & $606;
     $608 = $546 >>> 0 > $ssize$2$ph$i >>> 0;
     $or$cond8$i = $608 & $or$cond7$i;
     do {
      if ($or$cond8$i) {
       $609 = HEAP32[3132 >> 2] | 0;
       $610 = $548 - $ssize$2$ph$i | 0;
       $611 = $610 + $609 | 0;
       $612 = 0 - $609 | 0;
       $613 = $611 & $612;
       $614 = $613 >>> 0 < 2147483647;
       if ($614) {
        $615 = (tempInt = _sbrk($613 | 0) | 0, asyncState ? abort(-12) | 0 : tempInt) | 0;
        $616 = ($615 | 0) == (-1 | 0);
        if ($616) {
         (tempInt = _sbrk($605 | 0) | 0, asyncState ? abort(-12) | 0 : tempInt) | 0;
         break L279;
        } else {
         $617 = $613 + $ssize$2$ph$i | 0;
         $ssize$5$i = $617;
         break;
        }
       } else {
        $ssize$5$i = $ssize$2$ph$i;
       }
      } else {
       $ssize$5$i = $ssize$2$ph$i;
      }
     } while (0);
     $618 = ($br$2$ph$i | 0) == (-1 | 0);
     if (!$618) {
      $tbase$746$i = $br$2$ph$i;
      $tsize$745$i = $ssize$5$i;
      label = 193;
      break L257;
     }
    }
   } while (0);
   $619 = HEAP32[3096 >> 2] | 0;
   $620 = $619 | 4;
   HEAP32[3096 >> 2] = $620;
   label = 190;
  } else {
   label = 190;
  }
 } while (0);
 if ((label | 0) == 190) {
  $621 = $551 >>> 0 < 2147483647;
  if ($621) {
   $622 = (tempInt = _sbrk($551 | 0) | 0, asyncState ? abort(-12) | 0 : tempInt) | 0;
   $623 = (tempInt = _sbrk(0) | 0, asyncState ? abort(-12) | 0 : tempInt) | 0;
   $624 = ($622 | 0) != (-1 | 0);
   $625 = ($623 | 0) != (-1 | 0);
   $or$cond5$i = $624 & $625;
   $626 = $622 >>> 0 < $623 >>> 0;
   $or$cond10$i = $626 & $or$cond5$i;
   if ($or$cond10$i) {
    $627 = $623;
    $628 = $622;
    $629 = $627 - $628 | 0;
    $630 = $nb$0 + 40 | 0;
    $$not$i = $629 >>> 0 > $630 >>> 0;
    if ($$not$i) {
     $tbase$746$i = $622;
     $tsize$745$i = $629;
     label = 193;
    }
   }
  }
 }
 if ((label | 0) == 193) {
  $631 = HEAP32[3084 >> 2] | 0;
  $632 = $631 + $tsize$745$i | 0;
  HEAP32[3084 >> 2] = $632;
  $633 = HEAP32[3088 >> 2] | 0;
  $634 = $632 >>> 0 > $633 >>> 0;
  if ($634) {
   HEAP32[3088 >> 2] = $632;
  }
  $635 = HEAP32[2676 >> 2] | 0;
  $636 = ($635 | 0) == (0 | 0);
  do {
   if ($636) {
    $637 = HEAP32[2668 >> 2] | 0;
    $638 = ($637 | 0) == (0 | 0);
    $639 = $tbase$746$i >>> 0 < $637 >>> 0;
    $or$cond11$i = $638 | $639;
    if ($or$cond11$i) {
     HEAP32[2668 >> 2] = $tbase$746$i;
    }
    HEAP32[3100 >> 2] = $tbase$746$i;
    HEAP32[3104 >> 2] = $tsize$745$i;
    HEAP32[3112 >> 2] = 0;
    $640 = HEAP32[781] | 0;
    HEAP32[2688 >> 2] = $640;
    HEAP32[2684 >> 2] = -1;
    $i$01$i$i = 0;
    while (1) {
     $641 = $i$01$i$i << 1;
     $642 = 2692 + ($641 << 2) | 0;
     $643 = $642 + 12 | 0;
     HEAP32[$643 >> 2] = $642;
     $644 = $642 + 8 | 0;
     HEAP32[$644 >> 2] = $642;
     $645 = $i$01$i$i + 1 | 0;
     $exitcond$i$i = ($645 | 0) == 32;
     if ($exitcond$i$i) {
      break;
     } else {
      $i$01$i$i = $645;
     }
    }
    $646 = $tsize$745$i + -40 | 0;
    $647 = $tbase$746$i + 8 | 0;
    $648 = $647;
    $649 = $648 & 7;
    $650 = ($649 | 0) == 0;
    $651 = 0 - $648 | 0;
    $652 = $651 & 7;
    $653 = $650 ? 0 : $652;
    $654 = $tbase$746$i + $653 | 0;
    $655 = $646 - $653 | 0;
    HEAP32[2676 >> 2] = $654;
    HEAP32[2664 >> 2] = $655;
    $656 = $655 | 1;
    $657 = $654 + 4 | 0;
    HEAP32[$657 >> 2] = $656;
    $658 = $654 + $655 | 0;
    $659 = $658 + 4 | 0;
    HEAP32[$659 >> 2] = 40;
    $660 = HEAP32[3140 >> 2] | 0;
    HEAP32[2680 >> 2] = $660;
   } else {
    $sp$068$i = 3100;
    while (1) {
     $661 = HEAP32[$sp$068$i >> 2] | 0;
     $662 = $sp$068$i + 4 | 0;
     $663 = HEAP32[$662 >> 2] | 0;
     $664 = $661 + $663 | 0;
     $665 = ($tbase$746$i | 0) == ($664 | 0);
     if ($665) {
      $$lcssa147 = $661;
      $$lcssa149 = $662;
      $$lcssa151 = $663;
      $sp$068$i$lcssa = $sp$068$i;
      label = 203;
      break;
     }
     $666 = $sp$068$i + 8 | 0;
     $667 = HEAP32[$666 >> 2] | 0;
     $668 = ($667 | 0) == (0 | 0);
     if ($668) {
      break;
     } else {
      $sp$068$i = $667;
     }
    }
    if ((label | 0) == 203) {
     $669 = $sp$068$i$lcssa + 12 | 0;
     $670 = HEAP32[$669 >> 2] | 0;
     $671 = $670 & 8;
     $672 = ($671 | 0) == 0;
     if ($672) {
      $673 = $635 >>> 0 >= $$lcssa147 >>> 0;
      $674 = $635 >>> 0 < $tbase$746$i >>> 0;
      $or$cond48$i = $674 & $673;
      if ($or$cond48$i) {
       $675 = $$lcssa151 + $tsize$745$i | 0;
       HEAP32[$$lcssa149 >> 2] = $675;
       $676 = HEAP32[2664 >> 2] | 0;
       $677 = $635 + 8 | 0;
       $678 = $677;
       $679 = $678 & 7;
       $680 = ($679 | 0) == 0;
       $681 = 0 - $678 | 0;
       $682 = $681 & 7;
       $683 = $680 ? 0 : $682;
       $684 = $635 + $683 | 0;
       $685 = $tsize$745$i - $683 | 0;
       $686 = $685 + $676 | 0;
       HEAP32[2676 >> 2] = $684;
       HEAP32[2664 >> 2] = $686;
       $687 = $686 | 1;
       $688 = $684 + 4 | 0;
       HEAP32[$688 >> 2] = $687;
       $689 = $684 + $686 | 0;
       $690 = $689 + 4 | 0;
       HEAP32[$690 >> 2] = 40;
       $691 = HEAP32[3140 >> 2] | 0;
       HEAP32[2680 >> 2] = $691;
       break;
      }
     }
    }
    $692 = HEAP32[2668 >> 2] | 0;
    $693 = $tbase$746$i >>> 0 < $692 >>> 0;
    if ($693) {
     HEAP32[2668 >> 2] = $tbase$746$i;
     $757 = $tbase$746$i;
    } else {
     $757 = $692;
    }
    $694 = $tbase$746$i + $tsize$745$i | 0;
    $sp$167$i = 3100;
    while (1) {
     $695 = HEAP32[$sp$167$i >> 2] | 0;
     $696 = ($695 | 0) == ($694 | 0);
     if ($696) {
      $$lcssa144 = $sp$167$i;
      $sp$167$i$lcssa = $sp$167$i;
      label = 211;
      break;
     }
     $697 = $sp$167$i + 8 | 0;
     $698 = HEAP32[$697 >> 2] | 0;
     $699 = ($698 | 0) == (0 | 0);
     if ($699) {
      $sp$0$i$i$i = 3100;
      break;
     } else {
      $sp$167$i = $698;
     }
    }
    if ((label | 0) == 211) {
     $700 = $sp$167$i$lcssa + 12 | 0;
     $701 = HEAP32[$700 >> 2] | 0;
     $702 = $701 & 8;
     $703 = ($702 | 0) == 0;
     if ($703) {
      HEAP32[$$lcssa144 >> 2] = $tbase$746$i;
      $704 = $sp$167$i$lcssa + 4 | 0;
      $705 = HEAP32[$704 >> 2] | 0;
      $706 = $705 + $tsize$745$i | 0;
      HEAP32[$704 >> 2] = $706;
      $707 = $tbase$746$i + 8 | 0;
      $708 = $707;
      $709 = $708 & 7;
      $710 = ($709 | 0) == 0;
      $711 = 0 - $708 | 0;
      $712 = $711 & 7;
      $713 = $710 ? 0 : $712;
      $714 = $tbase$746$i + $713 | 0;
      $715 = $694 + 8 | 0;
      $716 = $715;
      $717 = $716 & 7;
      $718 = ($717 | 0) == 0;
      $719 = 0 - $716 | 0;
      $720 = $719 & 7;
      $721 = $718 ? 0 : $720;
      $722 = $694 + $721 | 0;
      $723 = $722;
      $724 = $714;
      $725 = $723 - $724 | 0;
      $726 = $714 + $nb$0 | 0;
      $727 = $725 - $nb$0 | 0;
      $728 = $nb$0 | 3;
      $729 = $714 + 4 | 0;
      HEAP32[$729 >> 2] = $728;
      $730 = ($722 | 0) == ($635 | 0);
      do {
       if ($730) {
        $731 = HEAP32[2664 >> 2] | 0;
        $732 = $731 + $727 | 0;
        HEAP32[2664 >> 2] = $732;
        HEAP32[2676 >> 2] = $726;
        $733 = $732 | 1;
        $734 = $726 + 4 | 0;
        HEAP32[$734 >> 2] = $733;
       } else {
        $735 = HEAP32[2672 >> 2] | 0;
        $736 = ($722 | 0) == ($735 | 0);
        if ($736) {
         $737 = HEAP32[2660 >> 2] | 0;
         $738 = $737 + $727 | 0;
         HEAP32[2660 >> 2] = $738;
         HEAP32[2672 >> 2] = $726;
         $739 = $738 | 1;
         $740 = $726 + 4 | 0;
         HEAP32[$740 >> 2] = $739;
         $741 = $726 + $738 | 0;
         HEAP32[$741 >> 2] = $738;
         break;
        }
        $742 = $722 + 4 | 0;
        $743 = HEAP32[$742 >> 2] | 0;
        $744 = $743 & 3;
        $745 = ($744 | 0) == 1;
        if ($745) {
         $746 = $743 & -8;
         $747 = $743 >>> 3;
         $748 = $743 >>> 0 < 256;
         L331 : do {
          if ($748) {
           $749 = $722 + 8 | 0;
           $750 = HEAP32[$749 >> 2] | 0;
           $751 = $722 + 12 | 0;
           $752 = HEAP32[$751 >> 2] | 0;
           $753 = $747 << 1;
           $754 = 2692 + ($753 << 2) | 0;
           $755 = ($750 | 0) == ($754 | 0);
           do {
            if (!$755) {
             $756 = $750 >>> 0 < $757 >>> 0;
             if ($756) {
              _abort(), asyncState ? abort(-12) | 0 : 0;
             }
             $758 = $750 + 12 | 0;
             $759 = HEAP32[$758 >> 2] | 0;
             $760 = ($759 | 0) == ($722 | 0);
             if ($760) {
              break;
             }
             _abort(), asyncState ? abort(-12) | 0 : 0;
            }
           } while (0);
           $761 = ($752 | 0) == ($750 | 0);
           if ($761) {
            $762 = 1 << $747;
            $763 = $762 ^ -1;
            $764 = HEAP32[663] | 0;
            $765 = $764 & $763;
            HEAP32[663] = $765;
            break;
           }
           $766 = ($752 | 0) == ($754 | 0);
           do {
            if ($766) {
             $$pre9$i$i = $752 + 8 | 0;
             $$pre$phi10$i$iZ2D = $$pre9$i$i;
            } else {
             $767 = $752 >>> 0 < $757 >>> 0;
             if ($767) {
              _abort(), asyncState ? abort(-12) | 0 : 0;
             }
             $768 = $752 + 8 | 0;
             $769 = HEAP32[$768 >> 2] | 0;
             $770 = ($769 | 0) == ($722 | 0);
             if ($770) {
              $$pre$phi10$i$iZ2D = $768;
              break;
             }
             _abort(), asyncState ? abort(-12) | 0 : 0;
            }
           } while (0);
           $771 = $750 + 12 | 0;
           HEAP32[$771 >> 2] = $752;
           HEAP32[$$pre$phi10$i$iZ2D >> 2] = $750;
          } else {
           $772 = $722 + 24 | 0;
           $773 = HEAP32[$772 >> 2] | 0;
           $774 = $722 + 12 | 0;
           $775 = HEAP32[$774 >> 2] | 0;
           $776 = ($775 | 0) == ($722 | 0);
           do {
            if ($776) {
             $786 = $722 + 16 | 0;
             $787 = $786 + 4 | 0;
             $788 = HEAP32[$787 >> 2] | 0;
             $789 = ($788 | 0) == (0 | 0);
             if ($789) {
              $790 = HEAP32[$786 >> 2] | 0;
              $791 = ($790 | 0) == (0 | 0);
              if ($791) {
               $R$3$i$i = 0;
               break;
              } else {
               $R$1$i$i = $790;
               $RP$1$i$i = $786;
              }
             } else {
              $R$1$i$i = $788;
              $RP$1$i$i = $787;
             }
             while (1) {
              $792 = $R$1$i$i + 20 | 0;
              $793 = HEAP32[$792 >> 2] | 0;
              $794 = ($793 | 0) == (0 | 0);
              if (!$794) {
               $R$1$i$i = $793;
               $RP$1$i$i = $792;
               continue;
              }
              $795 = $R$1$i$i + 16 | 0;
              $796 = HEAP32[$795 >> 2] | 0;
              $797 = ($796 | 0) == (0 | 0);
              if ($797) {
               $R$1$i$i$lcssa = $R$1$i$i;
               $RP$1$i$i$lcssa = $RP$1$i$i;
               break;
              } else {
               $R$1$i$i = $796;
               $RP$1$i$i = $795;
              }
             }
             $798 = $RP$1$i$i$lcssa >>> 0 < $757 >>> 0;
             if ($798) {
              _abort(), asyncState ? abort(-12) | 0 : 0;
             } else {
              HEAP32[$RP$1$i$i$lcssa >> 2] = 0;
              $R$3$i$i = $R$1$i$i$lcssa;
              break;
             }
            } else {
             $777 = $722 + 8 | 0;
             $778 = HEAP32[$777 >> 2] | 0;
             $779 = $778 >>> 0 < $757 >>> 0;
             if ($779) {
              _abort(), asyncState ? abort(-12) | 0 : 0;
             }
             $780 = $778 + 12 | 0;
             $781 = HEAP32[$780 >> 2] | 0;
             $782 = ($781 | 0) == ($722 | 0);
             if (!$782) {
              _abort(), asyncState ? abort(-12) | 0 : 0;
             }
             $783 = $775 + 8 | 0;
             $784 = HEAP32[$783 >> 2] | 0;
             $785 = ($784 | 0) == ($722 | 0);
             if ($785) {
              HEAP32[$780 >> 2] = $775;
              HEAP32[$783 >> 2] = $778;
              $R$3$i$i = $775;
              break;
             } else {
              _abort(), asyncState ? abort(-12) | 0 : 0;
             }
            }
           } while (0);
           $799 = ($773 | 0) == (0 | 0);
           if ($799) {
            break;
           }
           $800 = $722 + 28 | 0;
           $801 = HEAP32[$800 >> 2] | 0;
           $802 = 2956 + ($801 << 2) | 0;
           $803 = HEAP32[$802 >> 2] | 0;
           $804 = ($722 | 0) == ($803 | 0);
           do {
            if ($804) {
             HEAP32[$802 >> 2] = $R$3$i$i;
             $cond$i$i = ($R$3$i$i | 0) == (0 | 0);
             if (!$cond$i$i) {
              break;
             }
             $805 = 1 << $801;
             $806 = $805 ^ -1;
             $807 = HEAP32[2656 >> 2] | 0;
             $808 = $807 & $806;
             HEAP32[2656 >> 2] = $808;
             break L331;
            } else {
             $809 = HEAP32[2668 >> 2] | 0;
             $810 = $773 >>> 0 < $809 >>> 0;
             if ($810) {
              _abort(), asyncState ? abort(-12) | 0 : 0;
             }
             $811 = $773 + 16 | 0;
             $812 = HEAP32[$811 >> 2] | 0;
             $813 = ($812 | 0) == ($722 | 0);
             if ($813) {
              HEAP32[$811 >> 2] = $R$3$i$i;
             } else {
              $814 = $773 + 20 | 0;
              HEAP32[$814 >> 2] = $R$3$i$i;
             }
             $815 = ($R$3$i$i | 0) == (0 | 0);
             if ($815) {
              break L331;
             }
            }
           } while (0);
           $816 = HEAP32[2668 >> 2] | 0;
           $817 = $R$3$i$i >>> 0 < $816 >>> 0;
           if ($817) {
            _abort(), asyncState ? abort(-12) | 0 : 0;
           }
           $818 = $R$3$i$i + 24 | 0;
           HEAP32[$818 >> 2] = $773;
           $819 = $722 + 16 | 0;
           $820 = HEAP32[$819 >> 2] | 0;
           $821 = ($820 | 0) == (0 | 0);
           do {
            if (!$821) {
             $822 = $820 >>> 0 < $816 >>> 0;
             if ($822) {
              _abort(), asyncState ? abort(-12) | 0 : 0;
             } else {
              $823 = $R$3$i$i + 16 | 0;
              HEAP32[$823 >> 2] = $820;
              $824 = $820 + 24 | 0;
              HEAP32[$824 >> 2] = $R$3$i$i;
              break;
             }
            }
           } while (0);
           $825 = $819 + 4 | 0;
           $826 = HEAP32[$825 >> 2] | 0;
           $827 = ($826 | 0) == (0 | 0);
           if ($827) {
            break;
           }
           $828 = HEAP32[2668 >> 2] | 0;
           $829 = $826 >>> 0 < $828 >>> 0;
           if ($829) {
            _abort(), asyncState ? abort(-12) | 0 : 0;
           } else {
            $830 = $R$3$i$i + 20 | 0;
            HEAP32[$830 >> 2] = $826;
            $831 = $826 + 24 | 0;
            HEAP32[$831 >> 2] = $R$3$i$i;
            break;
           }
          }
         } while (0);
         $832 = $722 + $746 | 0;
         $833 = $746 + $727 | 0;
         $oldfirst$0$i$i = $832;
         $qsize$0$i$i = $833;
        } else {
         $oldfirst$0$i$i = $722;
         $qsize$0$i$i = $727;
        }
        $834 = $oldfirst$0$i$i + 4 | 0;
        $835 = HEAP32[$834 >> 2] | 0;
        $836 = $835 & -2;
        HEAP32[$834 >> 2] = $836;
        $837 = $qsize$0$i$i | 1;
        $838 = $726 + 4 | 0;
        HEAP32[$838 >> 2] = $837;
        $839 = $726 + $qsize$0$i$i | 0;
        HEAP32[$839 >> 2] = $qsize$0$i$i;
        $840 = $qsize$0$i$i >>> 3;
        $841 = $qsize$0$i$i >>> 0 < 256;
        if ($841) {
         $842 = $840 << 1;
         $843 = 2692 + ($842 << 2) | 0;
         $844 = HEAP32[663] | 0;
         $845 = 1 << $840;
         $846 = $844 & $845;
         $847 = ($846 | 0) == 0;
         do {
          if ($847) {
           $848 = $844 | $845;
           HEAP32[663] = $848;
           $$pre$i16$i = $843 + 8 | 0;
           $$pre$phi$i17$iZ2D = $$pre$i16$i;
           $F4$0$i$i = $843;
          } else {
           $849 = $843 + 8 | 0;
           $850 = HEAP32[$849 >> 2] | 0;
           $851 = HEAP32[2668 >> 2] | 0;
           $852 = $850 >>> 0 < $851 >>> 0;
           if (!$852) {
            $$pre$phi$i17$iZ2D = $849;
            $F4$0$i$i = $850;
            break;
           }
           _abort(), asyncState ? abort(-12) | 0 : 0;
          }
         } while (0);
         HEAP32[$$pre$phi$i17$iZ2D >> 2] = $726;
         $853 = $F4$0$i$i + 12 | 0;
         HEAP32[$853 >> 2] = $726;
         $854 = $726 + 8 | 0;
         HEAP32[$854 >> 2] = $F4$0$i$i;
         $855 = $726 + 12 | 0;
         HEAP32[$855 >> 2] = $843;
         break;
        }
        $856 = $qsize$0$i$i >>> 8;
        $857 = ($856 | 0) == 0;
        do {
         if ($857) {
          $I7$0$i$i = 0;
         } else {
          $858 = $qsize$0$i$i >>> 0 > 16777215;
          if ($858) {
           $I7$0$i$i = 31;
           break;
          }
          $859 = $856 + 1048320 | 0;
          $860 = $859 >>> 16;
          $861 = $860 & 8;
          $862 = $856 << $861;
          $863 = $862 + 520192 | 0;
          $864 = $863 >>> 16;
          $865 = $864 & 4;
          $866 = $865 | $861;
          $867 = $862 << $865;
          $868 = $867 + 245760 | 0;
          $869 = $868 >>> 16;
          $870 = $869 & 2;
          $871 = $866 | $870;
          $872 = 14 - $871 | 0;
          $873 = $867 << $870;
          $874 = $873 >>> 15;
          $875 = $872 + $874 | 0;
          $876 = $875 << 1;
          $877 = $875 + 7 | 0;
          $878 = $qsize$0$i$i >>> $877;
          $879 = $878 & 1;
          $880 = $879 | $876;
          $I7$0$i$i = $880;
         }
        } while (0);
        $881 = 2956 + ($I7$0$i$i << 2) | 0;
        $882 = $726 + 28 | 0;
        HEAP32[$882 >> 2] = $I7$0$i$i;
        $883 = $726 + 16 | 0;
        $884 = $883 + 4 | 0;
        HEAP32[$884 >> 2] = 0;
        HEAP32[$883 >> 2] = 0;
        $885 = HEAP32[2656 >> 2] | 0;
        $886 = 1 << $I7$0$i$i;
        $887 = $885 & $886;
        $888 = ($887 | 0) == 0;
        if ($888) {
         $889 = $885 | $886;
         HEAP32[2656 >> 2] = $889;
         HEAP32[$881 >> 2] = $726;
         $890 = $726 + 24 | 0;
         HEAP32[$890 >> 2] = $881;
         $891 = $726 + 12 | 0;
         HEAP32[$891 >> 2] = $726;
         $892 = $726 + 8 | 0;
         HEAP32[$892 >> 2] = $726;
         break;
        }
        $893 = HEAP32[$881 >> 2] | 0;
        $894 = ($I7$0$i$i | 0) == 31;
        $895 = $I7$0$i$i >>> 1;
        $896 = 25 - $895 | 0;
        $897 = $894 ? 0 : $896;
        $898 = $qsize$0$i$i << $897;
        $K8$0$i$i = $898;
        $T$0$i18$i = $893;
        while (1) {
         $899 = $T$0$i18$i + 4 | 0;
         $900 = HEAP32[$899 >> 2] | 0;
         $901 = $900 & -8;
         $902 = ($901 | 0) == ($qsize$0$i$i | 0);
         if ($902) {
          $T$0$i18$i$lcssa = $T$0$i18$i;
          label = 281;
          break;
         }
         $903 = $K8$0$i$i >>> 31;
         $904 = ($T$0$i18$i + 16 | 0) + ($903 << 2) | 0;
         $905 = $K8$0$i$i << 1;
         $906 = HEAP32[$904 >> 2] | 0;
         $907 = ($906 | 0) == (0 | 0);
         if ($907) {
          $$lcssa = $904;
          $T$0$i18$i$lcssa139 = $T$0$i18$i;
          label = 278;
          break;
         } else {
          $K8$0$i$i = $905;
          $T$0$i18$i = $906;
         }
        }
        if ((label | 0) == 278) {
         $908 = HEAP32[2668 >> 2] | 0;
         $909 = $$lcssa >>> 0 < $908 >>> 0;
         if ($909) {
          _abort(), asyncState ? abort(-12) | 0 : 0;
         } else {
          HEAP32[$$lcssa >> 2] = $726;
          $910 = $726 + 24 | 0;
          HEAP32[$910 >> 2] = $T$0$i18$i$lcssa139;
          $911 = $726 + 12 | 0;
          HEAP32[$911 >> 2] = $726;
          $912 = $726 + 8 | 0;
          HEAP32[$912 >> 2] = $726;
          break;
         }
        } else if ((label | 0) == 281) {
         $913 = $T$0$i18$i$lcssa + 8 | 0;
         $914 = HEAP32[$913 >> 2] | 0;
         $915 = HEAP32[2668 >> 2] | 0;
         $916 = $914 >>> 0 >= $915 >>> 0;
         $not$$i20$i = $T$0$i18$i$lcssa >>> 0 >= $915 >>> 0;
         $917 = $916 & $not$$i20$i;
         if ($917) {
          $918 = $914 + 12 | 0;
          HEAP32[$918 >> 2] = $726;
          HEAP32[$913 >> 2] = $726;
          $919 = $726 + 8 | 0;
          HEAP32[$919 >> 2] = $914;
          $920 = $726 + 12 | 0;
          HEAP32[$920 >> 2] = $T$0$i18$i$lcssa;
          $921 = $726 + 24 | 0;
          HEAP32[$921 >> 2] = 0;
          break;
         } else {
          _abort(), asyncState ? abort(-12) | 0 : 0;
         }
        }
       }
      } while (0);
      $1052 = $714 + 8 | 0;
      $$0 = $1052;
      return $$0 | 0;
     } else {
      $sp$0$i$i$i = 3100;
     }
    }
    while (1) {
     $922 = HEAP32[$sp$0$i$i$i >> 2] | 0;
     $923 = $922 >>> 0 > $635 >>> 0;
     if (!$923) {
      $924 = $sp$0$i$i$i + 4 | 0;
      $925 = HEAP32[$924 >> 2] | 0;
      $926 = $922 + $925 | 0;
      $927 = $926 >>> 0 > $635 >>> 0;
      if ($927) {
       $$lcssa142 = $926;
       break;
      }
     }
     $928 = $sp$0$i$i$i + 8 | 0;
     $929 = HEAP32[$928 >> 2] | 0;
     $sp$0$i$i$i = $929;
    }
    $930 = $$lcssa142 + -47 | 0;
    $931 = $930 + 8 | 0;
    $932 = $931;
    $933 = $932 & 7;
    $934 = ($933 | 0) == 0;
    $935 = 0 - $932 | 0;
    $936 = $935 & 7;
    $937 = $934 ? 0 : $936;
    $938 = $930 + $937 | 0;
    $939 = $635 + 16 | 0;
    $940 = $938 >>> 0 < $939 >>> 0;
    $941 = $940 ? $635 : $938;
    $942 = $941 + 8 | 0;
    $943 = $941 + 24 | 0;
    $944 = $tsize$745$i + -40 | 0;
    $945 = $tbase$746$i + 8 | 0;
    $946 = $945;
    $947 = $946 & 7;
    $948 = ($947 | 0) == 0;
    $949 = 0 - $946 | 0;
    $950 = $949 & 7;
    $951 = $948 ? 0 : $950;
    $952 = $tbase$746$i + $951 | 0;
    $953 = $944 - $951 | 0;
    HEAP32[2676 >> 2] = $952;
    HEAP32[2664 >> 2] = $953;
    $954 = $953 | 1;
    $955 = $952 + 4 | 0;
    HEAP32[$955 >> 2] = $954;
    $956 = $952 + $953 | 0;
    $957 = $956 + 4 | 0;
    HEAP32[$957 >> 2] = 40;
    $958 = HEAP32[3140 >> 2] | 0;
    HEAP32[2680 >> 2] = $958;
    $959 = $941 + 4 | 0;
    HEAP32[$959 >> 2] = 27;
    HEAP32[$942 >> 2] = HEAP32[3100 >> 2] | 0;
    HEAP32[$942 + 4 >> 2] = HEAP32[3100 + 4 >> 2] | 0;
    HEAP32[$942 + 8 >> 2] = HEAP32[3100 + 8 >> 2] | 0;
    HEAP32[$942 + 12 >> 2] = HEAP32[3100 + 12 >> 2] | 0;
    HEAP32[3100 >> 2] = $tbase$746$i;
    HEAP32[3104 >> 2] = $tsize$745$i;
    HEAP32[3112 >> 2] = 0;
    HEAP32[3108 >> 2] = $942;
    $p$0$i$i = $943;
    while (1) {
     $960 = $p$0$i$i + 4 | 0;
     HEAP32[$960 >> 2] = 7;
     $961 = $960 + 4 | 0;
     $962 = $961 >>> 0 < $$lcssa142 >>> 0;
     if ($962) {
      $p$0$i$i = $960;
     } else {
      break;
     }
    }
    $963 = ($941 | 0) == ($635 | 0);
    if (!$963) {
     $964 = $941;
     $965 = $635;
     $966 = $964 - $965 | 0;
     $967 = HEAP32[$959 >> 2] | 0;
     $968 = $967 & -2;
     HEAP32[$959 >> 2] = $968;
     $969 = $966 | 1;
     $970 = $635 + 4 | 0;
     HEAP32[$970 >> 2] = $969;
     HEAP32[$941 >> 2] = $966;
     $971 = $966 >>> 3;
     $972 = $966 >>> 0 < 256;
     if ($972) {
      $973 = $971 << 1;
      $974 = 2692 + ($973 << 2) | 0;
      $975 = HEAP32[663] | 0;
      $976 = 1 << $971;
      $977 = $975 & $976;
      $978 = ($977 | 0) == 0;
      if ($978) {
       $979 = $975 | $976;
       HEAP32[663] = $979;
       $$pre$i$i = $974 + 8 | 0;
       $$pre$phi$i$iZ2D = $$pre$i$i;
       $F$0$i$i = $974;
      } else {
       $980 = $974 + 8 | 0;
       $981 = HEAP32[$980 >> 2] | 0;
       $982 = HEAP32[2668 >> 2] | 0;
       $983 = $981 >>> 0 < $982 >>> 0;
       if ($983) {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       } else {
        $$pre$phi$i$iZ2D = $980;
        $F$0$i$i = $981;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D >> 2] = $635;
      $984 = $F$0$i$i + 12 | 0;
      HEAP32[$984 >> 2] = $635;
      $985 = $635 + 8 | 0;
      HEAP32[$985 >> 2] = $F$0$i$i;
      $986 = $635 + 12 | 0;
      HEAP32[$986 >> 2] = $974;
      break;
     }
     $987 = $966 >>> 8;
     $988 = ($987 | 0) == 0;
     if ($988) {
      $I1$0$i$i = 0;
     } else {
      $989 = $966 >>> 0 > 16777215;
      if ($989) {
       $I1$0$i$i = 31;
      } else {
       $990 = $987 + 1048320 | 0;
       $991 = $990 >>> 16;
       $992 = $991 & 8;
       $993 = $987 << $992;
       $994 = $993 + 520192 | 0;
       $995 = $994 >>> 16;
       $996 = $995 & 4;
       $997 = $996 | $992;
       $998 = $993 << $996;
       $999 = $998 + 245760 | 0;
       $1000 = $999 >>> 16;
       $1001 = $1000 & 2;
       $1002 = $997 | $1001;
       $1003 = 14 - $1002 | 0;
       $1004 = $998 << $1001;
       $1005 = $1004 >>> 15;
       $1006 = $1003 + $1005 | 0;
       $1007 = $1006 << 1;
       $1008 = $1006 + 7 | 0;
       $1009 = $966 >>> $1008;
       $1010 = $1009 & 1;
       $1011 = $1010 | $1007;
       $I1$0$i$i = $1011;
      }
     }
     $1012 = 2956 + ($I1$0$i$i << 2) | 0;
     $1013 = $635 + 28 | 0;
     HEAP32[$1013 >> 2] = $I1$0$i$i;
     $1014 = $635 + 20 | 0;
     HEAP32[$1014 >> 2] = 0;
     HEAP32[$939 >> 2] = 0;
     $1015 = HEAP32[2656 >> 2] | 0;
     $1016 = 1 << $I1$0$i$i;
     $1017 = $1015 & $1016;
     $1018 = ($1017 | 0) == 0;
     if ($1018) {
      $1019 = $1015 | $1016;
      HEAP32[2656 >> 2] = $1019;
      HEAP32[$1012 >> 2] = $635;
      $1020 = $635 + 24 | 0;
      HEAP32[$1020 >> 2] = $1012;
      $1021 = $635 + 12 | 0;
      HEAP32[$1021 >> 2] = $635;
      $1022 = $635 + 8 | 0;
      HEAP32[$1022 >> 2] = $635;
      break;
     }
     $1023 = HEAP32[$1012 >> 2] | 0;
     $1024 = ($I1$0$i$i | 0) == 31;
     $1025 = $I1$0$i$i >>> 1;
     $1026 = 25 - $1025 | 0;
     $1027 = $1024 ? 0 : $1026;
     $1028 = $966 << $1027;
     $K2$0$i$i = $1028;
     $T$0$i$i = $1023;
     while (1) {
      $1029 = $T$0$i$i + 4 | 0;
      $1030 = HEAP32[$1029 >> 2] | 0;
      $1031 = $1030 & -8;
      $1032 = ($1031 | 0) == ($966 | 0);
      if ($1032) {
       $T$0$i$i$lcssa = $T$0$i$i;
       label = 307;
       break;
      }
      $1033 = $K2$0$i$i >>> 31;
      $1034 = ($T$0$i$i + 16 | 0) + ($1033 << 2) | 0;
      $1035 = $K2$0$i$i << 1;
      $1036 = HEAP32[$1034 >> 2] | 0;
      $1037 = ($1036 | 0) == (0 | 0);
      if ($1037) {
       $$lcssa141 = $1034;
       $T$0$i$i$lcssa140 = $T$0$i$i;
       label = 304;
       break;
      } else {
       $K2$0$i$i = $1035;
       $T$0$i$i = $1036;
      }
     }
     if ((label | 0) == 304) {
      $1038 = HEAP32[2668 >> 2] | 0;
      $1039 = $$lcssa141 >>> 0 < $1038 >>> 0;
      if ($1039) {
       _abort(), asyncState ? abort(-12) | 0 : 0;
      } else {
       HEAP32[$$lcssa141 >> 2] = $635;
       $1040 = $635 + 24 | 0;
       HEAP32[$1040 >> 2] = $T$0$i$i$lcssa140;
       $1041 = $635 + 12 | 0;
       HEAP32[$1041 >> 2] = $635;
       $1042 = $635 + 8 | 0;
       HEAP32[$1042 >> 2] = $635;
       break;
      }
     } else if ((label | 0) == 307) {
      $1043 = $T$0$i$i$lcssa + 8 | 0;
      $1044 = HEAP32[$1043 >> 2] | 0;
      $1045 = HEAP32[2668 >> 2] | 0;
      $1046 = $1044 >>> 0 >= $1045 >>> 0;
      $not$$i$i = $T$0$i$i$lcssa >>> 0 >= $1045 >>> 0;
      $1047 = $1046 & $not$$i$i;
      if ($1047) {
       $1048 = $1044 + 12 | 0;
       HEAP32[$1048 >> 2] = $635;
       HEAP32[$1043 >> 2] = $635;
       $1049 = $635 + 8 | 0;
       HEAP32[$1049 >> 2] = $1044;
       $1050 = $635 + 12 | 0;
       HEAP32[$1050 >> 2] = $T$0$i$i$lcssa;
       $1051 = $635 + 24 | 0;
       HEAP32[$1051 >> 2] = 0;
       break;
      } else {
       _abort(), asyncState ? abort(-12) | 0 : 0;
      }
     }
    }
   }
  } while (0);
  $1053 = HEAP32[2664 >> 2] | 0;
  $1054 = $1053 >>> 0 > $nb$0 >>> 0;
  if ($1054) {
   $1055 = $1053 - $nb$0 | 0;
   HEAP32[2664 >> 2] = $1055;
   $1056 = HEAP32[2676 >> 2] | 0;
   $1057 = $1056 + $nb$0 | 0;
   HEAP32[2676 >> 2] = $1057;
   $1058 = $1055 | 1;
   $1059 = $1057 + 4 | 0;
   HEAP32[$1059 >> 2] = $1058;
   $1060 = $nb$0 | 3;
   $1061 = $1056 + 4 | 0;
   HEAP32[$1061 >> 2] = $1060;
   $1062 = $1056 + 8 | 0;
   $$0 = $1062;
   return $$0 | 0;
  }
 }
 $1063 = (tempInt = ___errno_location() | 0, asyncState ? abort(-12) | 0 : tempInt) | 0;
 HEAP32[$1063 >> 2] = 12;
 $$0 = 0;
 return $$0 | 0;
}

function _free($mem) {
 $mem = $mem | 0;
 var $$lcssa = 0, $$pre = 0, $$pre$phi41Z2D = 0, $$pre$phi43Z2D = 0, $$pre$phiZ2D = 0, $$pre40 = 0, $$pre42 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $F18$0 = 0, $I20$0 = 0, $K21$0 = 0, $R$1 = 0, $R$1$lcssa = 0, $R$3 = 0, $R8$1 = 0, $R8$1$lcssa = 0, $R8$3 = 0, $RP$1 = 0, $RP$1$lcssa = 0, $RP10$1 = 0, $RP10$1$lcssa = 0, $T$0 = 0, $T$0$lcssa = 0, $T$0$lcssa48 = 0, $cond20 = 0, $cond21 = 0, $not$ = 0, $p$1 = 0, $psize$1 = 0, $psize$2 = 0, $sp$0$i = 0, $sp$0$in$i = 0, label = 0, sp = 0;
 label = 0;
 sp = STACKTOP;
 $0 = ($mem | 0) == (0 | 0);
 asyncState ? abort(-12) | 0 : 0;
 if ($0) {
  return;
 }
 $1 = $mem + -8 | 0;
 $2 = HEAP32[2668 >> 2] | 0;
 $3 = $1 >>> 0 < $2 >>> 0;
 if ($3) {
  _abort(), asyncState ? abort(-12) | 0 : 0;
 }
 $4 = $mem + -4 | 0;
 $5 = HEAP32[$4 >> 2] | 0;
 $6 = $5 & 3;
 $7 = ($6 | 0) == 1;
 if ($7) {
  _abort(), asyncState ? abort(-12) | 0 : 0;
 }
 $8 = $5 & -8;
 $9 = $1 + $8 | 0;
 $10 = $5 & 1;
 $11 = ($10 | 0) == 0;
 do {
  if ($11) {
   $12 = HEAP32[$1 >> 2] | 0;
   $13 = ($6 | 0) == 0;
   if ($13) {
    return;
   }
   $14 = 0 - $12 | 0;
   $15 = $1 + $14 | 0;
   $16 = $12 + $8 | 0;
   $17 = $15 >>> 0 < $2 >>> 0;
   if ($17) {
    _abort(), asyncState ? abort(-12) | 0 : 0;
   }
   $18 = HEAP32[2672 >> 2] | 0;
   $19 = ($15 | 0) == ($18 | 0);
   if ($19) {
    $104 = $9 + 4 | 0;
    $105 = HEAP32[$104 >> 2] | 0;
    $106 = $105 & 3;
    $107 = ($106 | 0) == 3;
    if (!$107) {
     $p$1 = $15;
     $psize$1 = $16;
     break;
    }
    HEAP32[2660 >> 2] = $16;
    $108 = $105 & -2;
    HEAP32[$104 >> 2] = $108;
    $109 = $16 | 1;
    $110 = $15 + 4 | 0;
    HEAP32[$110 >> 2] = $109;
    $111 = $15 + $16 | 0;
    HEAP32[$111 >> 2] = $16;
    return;
   }
   $20 = $12 >>> 3;
   $21 = $12 >>> 0 < 256;
   if ($21) {
    $22 = $15 + 8 | 0;
    $23 = HEAP32[$22 >> 2] | 0;
    $24 = $15 + 12 | 0;
    $25 = HEAP32[$24 >> 2] | 0;
    $26 = $20 << 1;
    $27 = 2692 + ($26 << 2) | 0;
    $28 = ($23 | 0) == ($27 | 0);
    if (!$28) {
     $29 = $23 >>> 0 < $2 >>> 0;
     if ($29) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
     $30 = $23 + 12 | 0;
     $31 = HEAP32[$30 >> 2] | 0;
     $32 = ($31 | 0) == ($15 | 0);
     if (!$32) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
    }
    $33 = ($25 | 0) == ($23 | 0);
    if ($33) {
     $34 = 1 << $20;
     $35 = $34 ^ -1;
     $36 = HEAP32[663] | 0;
     $37 = $36 & $35;
     HEAP32[663] = $37;
     $p$1 = $15;
     $psize$1 = $16;
     break;
    }
    $38 = ($25 | 0) == ($27 | 0);
    if ($38) {
     $$pre42 = $25 + 8 | 0;
     $$pre$phi43Z2D = $$pre42;
    } else {
     $39 = $25 >>> 0 < $2 >>> 0;
     if ($39) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
     $40 = $25 + 8 | 0;
     $41 = HEAP32[$40 >> 2] | 0;
     $42 = ($41 | 0) == ($15 | 0);
     if ($42) {
      $$pre$phi43Z2D = $40;
     } else {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
    }
    $43 = $23 + 12 | 0;
    HEAP32[$43 >> 2] = $25;
    HEAP32[$$pre$phi43Z2D >> 2] = $23;
    $p$1 = $15;
    $psize$1 = $16;
    break;
   }
   $44 = $15 + 24 | 0;
   $45 = HEAP32[$44 >> 2] | 0;
   $46 = $15 + 12 | 0;
   $47 = HEAP32[$46 >> 2] | 0;
   $48 = ($47 | 0) == ($15 | 0);
   do {
    if ($48) {
     $58 = $15 + 16 | 0;
     $59 = $58 + 4 | 0;
     $60 = HEAP32[$59 >> 2] | 0;
     $61 = ($60 | 0) == (0 | 0);
     if ($61) {
      $62 = HEAP32[$58 >> 2] | 0;
      $63 = ($62 | 0) == (0 | 0);
      if ($63) {
       $R$3 = 0;
       break;
      } else {
       $R$1 = $62;
       $RP$1 = $58;
      }
     } else {
      $R$1 = $60;
      $RP$1 = $59;
     }
     while (1) {
      $64 = $R$1 + 20 | 0;
      $65 = HEAP32[$64 >> 2] | 0;
      $66 = ($65 | 0) == (0 | 0);
      if (!$66) {
       $R$1 = $65;
       $RP$1 = $64;
       continue;
      }
      $67 = $R$1 + 16 | 0;
      $68 = HEAP32[$67 >> 2] | 0;
      $69 = ($68 | 0) == (0 | 0);
      if ($69) {
       $R$1$lcssa = $R$1;
       $RP$1$lcssa = $RP$1;
       break;
      } else {
       $R$1 = $68;
       $RP$1 = $67;
      }
     }
     $70 = $RP$1$lcssa >>> 0 < $2 >>> 0;
     if ($70) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     } else {
      HEAP32[$RP$1$lcssa >> 2] = 0;
      $R$3 = $R$1$lcssa;
      break;
     }
    } else {
     $49 = $15 + 8 | 0;
     $50 = HEAP32[$49 >> 2] | 0;
     $51 = $50 >>> 0 < $2 >>> 0;
     if ($51) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
     $52 = $50 + 12 | 0;
     $53 = HEAP32[$52 >> 2] | 0;
     $54 = ($53 | 0) == ($15 | 0);
     if (!$54) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
     $55 = $47 + 8 | 0;
     $56 = HEAP32[$55 >> 2] | 0;
     $57 = ($56 | 0) == ($15 | 0);
     if ($57) {
      HEAP32[$52 >> 2] = $47;
      HEAP32[$55 >> 2] = $50;
      $R$3 = $47;
      break;
     } else {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
    }
   } while (0);
   $71 = ($45 | 0) == (0 | 0);
   if ($71) {
    $p$1 = $15;
    $psize$1 = $16;
   } else {
    $72 = $15 + 28 | 0;
    $73 = HEAP32[$72 >> 2] | 0;
    $74 = 2956 + ($73 << 2) | 0;
    $75 = HEAP32[$74 >> 2] | 0;
    $76 = ($15 | 0) == ($75 | 0);
    if ($76) {
     HEAP32[$74 >> 2] = $R$3;
     $cond20 = ($R$3 | 0) == (0 | 0);
     if ($cond20) {
      $77 = 1 << $73;
      $78 = $77 ^ -1;
      $79 = HEAP32[2656 >> 2] | 0;
      $80 = $79 & $78;
      HEAP32[2656 >> 2] = $80;
      $p$1 = $15;
      $psize$1 = $16;
      break;
     }
    } else {
     $81 = HEAP32[2668 >> 2] | 0;
     $82 = $45 >>> 0 < $81 >>> 0;
     if ($82) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
     $83 = $45 + 16 | 0;
     $84 = HEAP32[$83 >> 2] | 0;
     $85 = ($84 | 0) == ($15 | 0);
     if ($85) {
      HEAP32[$83 >> 2] = $R$3;
     } else {
      $86 = $45 + 20 | 0;
      HEAP32[$86 >> 2] = $R$3;
     }
     $87 = ($R$3 | 0) == (0 | 0);
     if ($87) {
      $p$1 = $15;
      $psize$1 = $16;
      break;
     }
    }
    $88 = HEAP32[2668 >> 2] | 0;
    $89 = $R$3 >>> 0 < $88 >>> 0;
    if ($89) {
     _abort(), asyncState ? abort(-12) | 0 : 0;
    }
    $90 = $R$3 + 24 | 0;
    HEAP32[$90 >> 2] = $45;
    $91 = $15 + 16 | 0;
    $92 = HEAP32[$91 >> 2] | 0;
    $93 = ($92 | 0) == (0 | 0);
    do {
     if (!$93) {
      $94 = $92 >>> 0 < $88 >>> 0;
      if ($94) {
       _abort(), asyncState ? abort(-12) | 0 : 0;
      } else {
       $95 = $R$3 + 16 | 0;
       HEAP32[$95 >> 2] = $92;
       $96 = $92 + 24 | 0;
       HEAP32[$96 >> 2] = $R$3;
       break;
      }
     }
    } while (0);
    $97 = $91 + 4 | 0;
    $98 = HEAP32[$97 >> 2] | 0;
    $99 = ($98 | 0) == (0 | 0);
    if ($99) {
     $p$1 = $15;
     $psize$1 = $16;
    } else {
     $100 = HEAP32[2668 >> 2] | 0;
     $101 = $98 >>> 0 < $100 >>> 0;
     if ($101) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     } else {
      $102 = $R$3 + 20 | 0;
      HEAP32[$102 >> 2] = $98;
      $103 = $98 + 24 | 0;
      HEAP32[$103 >> 2] = $R$3;
      $p$1 = $15;
      $psize$1 = $16;
      break;
     }
    }
   }
  } else {
   $p$1 = $1;
   $psize$1 = $8;
  }
 } while (0);
 $112 = $p$1 >>> 0 < $9 >>> 0;
 if (!$112) {
  _abort(), asyncState ? abort(-12) | 0 : 0;
 }
 $113 = $9 + 4 | 0;
 $114 = HEAP32[$113 >> 2] | 0;
 $115 = $114 & 1;
 $116 = ($115 | 0) == 0;
 if ($116) {
  _abort(), asyncState ? abort(-12) | 0 : 0;
 }
 $117 = $114 & 2;
 $118 = ($117 | 0) == 0;
 if ($118) {
  $119 = HEAP32[2676 >> 2] | 0;
  $120 = ($9 | 0) == ($119 | 0);
  if ($120) {
   $121 = HEAP32[2664 >> 2] | 0;
   $122 = $121 + $psize$1 | 0;
   HEAP32[2664 >> 2] = $122;
   HEAP32[2676 >> 2] = $p$1;
   $123 = $122 | 1;
   $124 = $p$1 + 4 | 0;
   HEAP32[$124 >> 2] = $123;
   $125 = HEAP32[2672 >> 2] | 0;
   $126 = ($p$1 | 0) == ($125 | 0);
   if (!$126) {
    return;
   }
   HEAP32[2672 >> 2] = 0;
   HEAP32[2660 >> 2] = 0;
   return;
  }
  $127 = HEAP32[2672 >> 2] | 0;
  $128 = ($9 | 0) == ($127 | 0);
  if ($128) {
   $129 = HEAP32[2660 >> 2] | 0;
   $130 = $129 + $psize$1 | 0;
   HEAP32[2660 >> 2] = $130;
   HEAP32[2672 >> 2] = $p$1;
   $131 = $130 | 1;
   $132 = $p$1 + 4 | 0;
   HEAP32[$132 >> 2] = $131;
   $133 = $p$1 + $130 | 0;
   HEAP32[$133 >> 2] = $130;
   return;
  }
  $134 = $114 & -8;
  $135 = $134 + $psize$1 | 0;
  $136 = $114 >>> 3;
  $137 = $114 >>> 0 < 256;
  do {
   if ($137) {
    $138 = $9 + 8 | 0;
    $139 = HEAP32[$138 >> 2] | 0;
    $140 = $9 + 12 | 0;
    $141 = HEAP32[$140 >> 2] | 0;
    $142 = $136 << 1;
    $143 = 2692 + ($142 << 2) | 0;
    $144 = ($139 | 0) == ($143 | 0);
    if (!$144) {
     $145 = HEAP32[2668 >> 2] | 0;
     $146 = $139 >>> 0 < $145 >>> 0;
     if ($146) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
     $147 = $139 + 12 | 0;
     $148 = HEAP32[$147 >> 2] | 0;
     $149 = ($148 | 0) == ($9 | 0);
     if (!$149) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
    }
    $150 = ($141 | 0) == ($139 | 0);
    if ($150) {
     $151 = 1 << $136;
     $152 = $151 ^ -1;
     $153 = HEAP32[663] | 0;
     $154 = $153 & $152;
     HEAP32[663] = $154;
     break;
    }
    $155 = ($141 | 0) == ($143 | 0);
    if ($155) {
     $$pre40 = $141 + 8 | 0;
     $$pre$phi41Z2D = $$pre40;
    } else {
     $156 = HEAP32[2668 >> 2] | 0;
     $157 = $141 >>> 0 < $156 >>> 0;
     if ($157) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
     $158 = $141 + 8 | 0;
     $159 = HEAP32[$158 >> 2] | 0;
     $160 = ($159 | 0) == ($9 | 0);
     if ($160) {
      $$pre$phi41Z2D = $158;
     } else {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
    }
    $161 = $139 + 12 | 0;
    HEAP32[$161 >> 2] = $141;
    HEAP32[$$pre$phi41Z2D >> 2] = $139;
   } else {
    $162 = $9 + 24 | 0;
    $163 = HEAP32[$162 >> 2] | 0;
    $164 = $9 + 12 | 0;
    $165 = HEAP32[$164 >> 2] | 0;
    $166 = ($165 | 0) == ($9 | 0);
    do {
     if ($166) {
      $177 = $9 + 16 | 0;
      $178 = $177 + 4 | 0;
      $179 = HEAP32[$178 >> 2] | 0;
      $180 = ($179 | 0) == (0 | 0);
      if ($180) {
       $181 = HEAP32[$177 >> 2] | 0;
       $182 = ($181 | 0) == (0 | 0);
       if ($182) {
        $R8$3 = 0;
        break;
       } else {
        $R8$1 = $181;
        $RP10$1 = $177;
       }
      } else {
       $R8$1 = $179;
       $RP10$1 = $178;
      }
      while (1) {
       $183 = $R8$1 + 20 | 0;
       $184 = HEAP32[$183 >> 2] | 0;
       $185 = ($184 | 0) == (0 | 0);
       if (!$185) {
        $R8$1 = $184;
        $RP10$1 = $183;
        continue;
       }
       $186 = $R8$1 + 16 | 0;
       $187 = HEAP32[$186 >> 2] | 0;
       $188 = ($187 | 0) == (0 | 0);
       if ($188) {
        $R8$1$lcssa = $R8$1;
        $RP10$1$lcssa = $RP10$1;
        break;
       } else {
        $R8$1 = $187;
        $RP10$1 = $186;
       }
      }
      $189 = HEAP32[2668 >> 2] | 0;
      $190 = $RP10$1$lcssa >>> 0 < $189 >>> 0;
      if ($190) {
       _abort(), asyncState ? abort(-12) | 0 : 0;
      } else {
       HEAP32[$RP10$1$lcssa >> 2] = 0;
       $R8$3 = $R8$1$lcssa;
       break;
      }
     } else {
      $167 = $9 + 8 | 0;
      $168 = HEAP32[$167 >> 2] | 0;
      $169 = HEAP32[2668 >> 2] | 0;
      $170 = $168 >>> 0 < $169 >>> 0;
      if ($170) {
       _abort(), asyncState ? abort(-12) | 0 : 0;
      }
      $171 = $168 + 12 | 0;
      $172 = HEAP32[$171 >> 2] | 0;
      $173 = ($172 | 0) == ($9 | 0);
      if (!$173) {
       _abort(), asyncState ? abort(-12) | 0 : 0;
      }
      $174 = $165 + 8 | 0;
      $175 = HEAP32[$174 >> 2] | 0;
      $176 = ($175 | 0) == ($9 | 0);
      if ($176) {
       HEAP32[$171 >> 2] = $165;
       HEAP32[$174 >> 2] = $168;
       $R8$3 = $165;
       break;
      } else {
       _abort(), asyncState ? abort(-12) | 0 : 0;
      }
     }
    } while (0);
    $191 = ($163 | 0) == (0 | 0);
    if (!$191) {
     $192 = $9 + 28 | 0;
     $193 = HEAP32[$192 >> 2] | 0;
     $194 = 2956 + ($193 << 2) | 0;
     $195 = HEAP32[$194 >> 2] | 0;
     $196 = ($9 | 0) == ($195 | 0);
     if ($196) {
      HEAP32[$194 >> 2] = $R8$3;
      $cond21 = ($R8$3 | 0) == (0 | 0);
      if ($cond21) {
       $197 = 1 << $193;
       $198 = $197 ^ -1;
       $199 = HEAP32[2656 >> 2] | 0;
       $200 = $199 & $198;
       HEAP32[2656 >> 2] = $200;
       break;
      }
     } else {
      $201 = HEAP32[2668 >> 2] | 0;
      $202 = $163 >>> 0 < $201 >>> 0;
      if ($202) {
       _abort(), asyncState ? abort(-12) | 0 : 0;
      }
      $203 = $163 + 16 | 0;
      $204 = HEAP32[$203 >> 2] | 0;
      $205 = ($204 | 0) == ($9 | 0);
      if ($205) {
       HEAP32[$203 >> 2] = $R8$3;
      } else {
       $206 = $163 + 20 | 0;
       HEAP32[$206 >> 2] = $R8$3;
      }
      $207 = ($R8$3 | 0) == (0 | 0);
      if ($207) {
       break;
      }
     }
     $208 = HEAP32[2668 >> 2] | 0;
     $209 = $R8$3 >>> 0 < $208 >>> 0;
     if ($209) {
      _abort(), asyncState ? abort(-12) | 0 : 0;
     }
     $210 = $R8$3 + 24 | 0;
     HEAP32[$210 >> 2] = $163;
     $211 = $9 + 16 | 0;
     $212 = HEAP32[$211 >> 2] | 0;
     $213 = ($212 | 0) == (0 | 0);
     do {
      if (!$213) {
       $214 = $212 >>> 0 < $208 >>> 0;
       if ($214) {
        _abort(), asyncState ? abort(-12) | 0 : 0;
       } else {
        $215 = $R8$3 + 16 | 0;
        HEAP32[$215 >> 2] = $212;
        $216 = $212 + 24 | 0;
        HEAP32[$216 >> 2] = $R8$3;
        break;
       }
      }
     } while (0);
     $217 = $211 + 4 | 0;
     $218 = HEAP32[$217 >> 2] | 0;
     $219 = ($218 | 0) == (0 | 0);
     if (!$219) {
      $220 = HEAP32[2668 >> 2] | 0;
      $221 = $218 >>> 0 < $220 >>> 0;
      if ($221) {
       _abort(), asyncState ? abort(-12) | 0 : 0;
      } else {
       $222 = $R8$3 + 20 | 0;
       HEAP32[$222 >> 2] = $218;
       $223 = $218 + 24 | 0;
       HEAP32[$223 >> 2] = $R8$3;
       break;
      }
     }
    }
   }
  } while (0);
  $224 = $135 | 1;
  $225 = $p$1 + 4 | 0;
  HEAP32[$225 >> 2] = $224;
  $226 = $p$1 + $135 | 0;
  HEAP32[$226 >> 2] = $135;
  $227 = HEAP32[2672 >> 2] | 0;
  $228 = ($p$1 | 0) == ($227 | 0);
  if ($228) {
   HEAP32[2660 >> 2] = $135;
   return;
  } else {
   $psize$2 = $135;
  }
 } else {
  $229 = $114 & -2;
  HEAP32[$113 >> 2] = $229;
  $230 = $psize$1 | 1;
  $231 = $p$1 + 4 | 0;
  HEAP32[$231 >> 2] = $230;
  $232 = $p$1 + $psize$1 | 0;
  HEAP32[$232 >> 2] = $psize$1;
  $psize$2 = $psize$1;
 }
 $233 = $psize$2 >>> 3;
 $234 = $psize$2 >>> 0 < 256;
 if ($234) {
  $235 = $233 << 1;
  $236 = 2692 + ($235 << 2) | 0;
  $237 = HEAP32[663] | 0;
  $238 = 1 << $233;
  $239 = $237 & $238;
  $240 = ($239 | 0) == 0;
  if ($240) {
   $241 = $237 | $238;
   HEAP32[663] = $241;
   $$pre = $236 + 8 | 0;
   $$pre$phiZ2D = $$pre;
   $F18$0 = $236;
  } else {
   $242 = $236 + 8 | 0;
   $243 = HEAP32[$242 >> 2] | 0;
   $244 = HEAP32[2668 >> 2] | 0;
   $245 = $243 >>> 0 < $244 >>> 0;
   if ($245) {
    _abort(), asyncState ? abort(-12) | 0 : 0;
   } else {
    $$pre$phiZ2D = $242;
    $F18$0 = $243;
   }
  }
  HEAP32[$$pre$phiZ2D >> 2] = $p$1;
  $246 = $F18$0 + 12 | 0;
  HEAP32[$246 >> 2] = $p$1;
  $247 = $p$1 + 8 | 0;
  HEAP32[$247 >> 2] = $F18$0;
  $248 = $p$1 + 12 | 0;
  HEAP32[$248 >> 2] = $236;
  return;
 }
 $249 = $psize$2 >>> 8;
 $250 = ($249 | 0) == 0;
 if ($250) {
  $I20$0 = 0;
 } else {
  $251 = $psize$2 >>> 0 > 16777215;
  if ($251) {
   $I20$0 = 31;
  } else {
   $252 = $249 + 1048320 | 0;
   $253 = $252 >>> 16;
   $254 = $253 & 8;
   $255 = $249 << $254;
   $256 = $255 + 520192 | 0;
   $257 = $256 >>> 16;
   $258 = $257 & 4;
   $259 = $258 | $254;
   $260 = $255 << $258;
   $261 = $260 + 245760 | 0;
   $262 = $261 >>> 16;
   $263 = $262 & 2;
   $264 = $259 | $263;
   $265 = 14 - $264 | 0;
   $266 = $260 << $263;
   $267 = $266 >>> 15;
   $268 = $265 + $267 | 0;
   $269 = $268 << 1;
   $270 = $268 + 7 | 0;
   $271 = $psize$2 >>> $270;
   $272 = $271 & 1;
   $273 = $272 | $269;
   $I20$0 = $273;
  }
 }
 $274 = 2956 + ($I20$0 << 2) | 0;
 $275 = $p$1 + 28 | 0;
 HEAP32[$275 >> 2] = $I20$0;
 $276 = $p$1 + 16 | 0;
 $277 = $p$1 + 20 | 0;
 HEAP32[$277 >> 2] = 0;
 HEAP32[$276 >> 2] = 0;
 $278 = HEAP32[2656 >> 2] | 0;
 $279 = 1 << $I20$0;
 $280 = $278 & $279;
 $281 = ($280 | 0) == 0;
 do {
  if ($281) {
   $282 = $278 | $279;
   HEAP32[2656 >> 2] = $282;
   HEAP32[$274 >> 2] = $p$1;
   $283 = $p$1 + 24 | 0;
   HEAP32[$283 >> 2] = $274;
   $284 = $p$1 + 12 | 0;
   HEAP32[$284 >> 2] = $p$1;
   $285 = $p$1 + 8 | 0;
   HEAP32[$285 >> 2] = $p$1;
  } else {
   $286 = HEAP32[$274 >> 2] | 0;
   $287 = ($I20$0 | 0) == 31;
   $288 = $I20$0 >>> 1;
   $289 = 25 - $288 | 0;
   $290 = $287 ? 0 : $289;
   $291 = $psize$2 << $290;
   $K21$0 = $291;
   $T$0 = $286;
   while (1) {
    $292 = $T$0 + 4 | 0;
    $293 = HEAP32[$292 >> 2] | 0;
    $294 = $293 & -8;
    $295 = ($294 | 0) == ($psize$2 | 0);
    if ($295) {
     $T$0$lcssa = $T$0;
     label = 130;
     break;
    }
    $296 = $K21$0 >>> 31;
    $297 = ($T$0 + 16 | 0) + ($296 << 2) | 0;
    $298 = $K21$0 << 1;
    $299 = HEAP32[$297 >> 2] | 0;
    $300 = ($299 | 0) == (0 | 0);
    if ($300) {
     $$lcssa = $297;
     $T$0$lcssa48 = $T$0;
     label = 127;
     break;
    } else {
     $K21$0 = $298;
     $T$0 = $299;
    }
   }
   if ((label | 0) == 127) {
    $301 = HEAP32[2668 >> 2] | 0;
    $302 = $$lcssa >>> 0 < $301 >>> 0;
    if ($302) {
     _abort(), asyncState ? abort(-12) | 0 : 0;
    } else {
     HEAP32[$$lcssa >> 2] = $p$1;
     $303 = $p$1 + 24 | 0;
     HEAP32[$303 >> 2] = $T$0$lcssa48;
     $304 = $p$1 + 12 | 0;
     HEAP32[$304 >> 2] = $p$1;
     $305 = $p$1 + 8 | 0;
     HEAP32[$305 >> 2] = $p$1;
     break;
    }
   } else if ((label | 0) == 130) {
    $306 = $T$0$lcssa + 8 | 0;
    $307 = HEAP32[$306 >> 2] | 0;
    $308 = HEAP32[2668 >> 2] | 0;
    $309 = $307 >>> 0 >= $308 >>> 0;
    $not$ = $T$0$lcssa >>> 0 >= $308 >>> 0;
    $310 = $309 & $not$;
    if ($310) {
     $311 = $307 + 12 | 0;
     HEAP32[$311 >> 2] = $p$1;
     HEAP32[$306 >> 2] = $p$1;
     $312 = $p$1 + 8 | 0;
     HEAP32[$312 >> 2] = $307;
     $313 = $p$1 + 12 | 0;
     HEAP32[$313 >> 2] = $T$0$lcssa;
     $314 = $p$1 + 24 | 0;
     HEAP32[$314 >> 2] = 0;
     break;
    } else {
     _abort(), asyncState ? abort(-12) | 0 : 0;
    }
   }
  }
 } while (0);
 $315 = HEAP32[2684 >> 2] | 0;
 $316 = $315 + -1 | 0;
 HEAP32[2684 >> 2] = $316;
 $317 = ($316 | 0) == 0;
 if ($317) {
  $sp$0$in$i = 3108;
 } else {
  return;
 }
 while (1) {
  $sp$0$i = HEAP32[$sp$0$in$i >> 2] | 0;
  $318 = ($sp$0$i | 0) == (0 | 0);
  $319 = $sp$0$i + 8 | 0;
  if ($318) {
   break;
  } else {
   $sp$0$in$i = $319;
  }
 }
 HEAP32[2684 >> 2] = -1;
 return;
}
function emterpret(pc) {
 pc = pc | 0;
 var sp = 0, inst = 0, lx = 0, ly = 0, lz = 0;
 var ld = 0.0;
 HEAP32[EMTSTACKTOP >> 2] = pc;
 sp = EMTSTACKTOP + 8 | 0;
 assert(HEAPU8[pc >> 0] >>> 0 == 140 | 0);
 lx = HEAPU16[pc + 2 >> 1] | 0;
 EMTSTACKTOP = EMTSTACKTOP + (lx + 1 << 3) | 0;
 assert((EMTSTACKTOP | 0) <= (EMT_STACK_MAX | 0) | 0);
 if ((asyncState | 0) != 2) {} else {
  pc = (HEAP32[sp - 4 >> 2] | 0) - 8 | 0;
 }
 pc = pc + 4 | 0;
 while (1) {
  pc = pc + 4 | 0;
  inst = HEAP32[pc >> 2] | 0;
  lx = inst >> 8 & 255;
  ly = inst >> 16 & 255;
  lz = inst >>> 24;
  switch (inst & 255) {
  case 0:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] | 0;
   break;
  case 1:
   HEAP32[sp + (lx << 3) >> 2] = inst >> 16;
   break;
  case 2:
   pc = pc + 4 | 0;
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[pc >> 2] | 0;
   break;
  case 3:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) + (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 4:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) - (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 5:
   HEAP32[sp + (lx << 3) >> 2] = Math_imul(HEAP32[sp + (ly << 3) >> 2] | 0, HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 7:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] >>> 0) / (HEAP32[sp + (lz << 3) >> 2] >>> 0) >>> 0;
   break;
  case 9:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] >>> 0) % (HEAP32[sp + (lz << 3) >> 2] >>> 0) >>> 0;
   break;
  case 13:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) == (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 14:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) != (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 15:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) < (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 16:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] >>> 0 < HEAP32[sp + (lz << 3) >> 2] >>> 0 | 0;
   break;
  case 17:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) <= (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 19:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) & (HEAP32[sp + (lz << 3) >> 2] | 0);
   break;
  case 20:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] | 0 | (HEAP32[sp + (lz << 3) >> 2] | 0);
   break;
  case 21:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) ^ (HEAP32[sp + (lz << 3) >> 2] | 0);
   break;
  case 22:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) << (HEAP32[sp + (lz << 3) >> 2] | 0);
   break;
  case 24:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) >>> (HEAP32[sp + (lz << 3) >> 2] | 0);
   break;
  case 25:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) + (inst >> 24) | 0;
   break;
  case 26:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) - (inst >> 24) | 0;
   break;
  case 27:
   HEAP32[sp + (lx << 3) >> 2] = Math_imul(HEAP32[sp + (ly << 3) >> 2] | 0, inst >> 24) | 0;
   break;
  case 28:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) / (inst >> 24) | 0;
   break;
  case 29:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] >>> 0) / (lz >>> 0) >>> 0;
   break;
  case 30:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) % (inst >> 24) | 0;
   break;
  case 31:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] >>> 0) % (lz >>> 0) >>> 0;
   break;
  case 32:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) == inst >> 24 | 0;
   break;
  case 33:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) != inst >> 24 | 0;
   break;
  case 34:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) < inst >> 24 | 0;
   break;
  case 35:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] >>> 0 < lz >>> 0 | 0;
   break;
  case 37:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] >>> 0 <= lz >>> 0 | 0;
   break;
  case 38:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) & inst >> 24;
   break;
  case 39:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] | 0 | inst >> 24;
   break;
  case 40:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) ^ inst >> 24;
   break;
  case 41:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) << lz;
   break;
  case 42:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) >> lz;
   break;
  case 43:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) >>> lz;
   break;
  case 45:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) == (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = pc + 4 | 0;
   } else {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 46:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) != (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = pc + 4 | 0;
   } else {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 47:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) < (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = pc + 4 | 0;
   } else {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 48:
   if (HEAP32[sp + (ly << 3) >> 2] >>> 0 < HEAP32[sp + (lz << 3) >> 2] >>> 0) {
    pc = pc + 4 | 0;
   } else {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 49:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) <= (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = pc + 4 | 0;
   } else {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 52:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) == (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   } else {
    pc = pc + 4 | 0;
   }
   break;
  case 53:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) != (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   } else {
    pc = pc + 4 | 0;
   }
   break;
  case 54:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) < (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   } else {
    pc = pc + 4 | 0;
   }
   break;
  case 55:
   if (HEAP32[sp + (ly << 3) >> 2] >>> 0 < HEAP32[sp + (lz << 3) >> 2] >>> 0) {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   } else {
    pc = pc + 4 | 0;
   }
   break;
  case 58:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[sp + (ly << 3) >> 3];
   break;
  case 59:
   HEAPF64[sp + (lx << 3) >> 3] = +(inst >> 16);
   break;
  case 60:
   pc = pc + 4 | 0;
   HEAPF64[sp + (lx << 3) >> 3] = +(HEAP32[pc >> 2] | 0);
   break;
  case 61:
   pc = pc + 4 | 0;
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF32[pc >> 2];
   break;
  case 62:
   HEAP32[tempDoublePtr >> 2] = HEAP32[pc + 4 >> 2];
   HEAP32[tempDoublePtr + 4 >> 2] = HEAP32[pc + 8 >> 2];
   pc = pc + 8 | 0;
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[tempDoublePtr >> 3];
   break;
  case 63:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[sp + (ly << 3) >> 3] + +HEAPF64[sp + (lz << 3) >> 3];
   break;
  case 64:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[sp + (ly << 3) >> 3] - +HEAPF64[sp + (lz << 3) >> 3];
   break;
  case 65:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[sp + (ly << 3) >> 3] * +HEAPF64[sp + (lz << 3) >> 3];
   break;
  case 68:
   HEAPF64[sp + (lx << 3) >> 3] = -+HEAPF64[sp + (ly << 3) >> 3];
   break;
  case 69:
   HEAP32[sp + (lx << 3) >> 2] = +HEAPF64[sp + (ly << 3) >> 3] == +HEAPF64[sp + (lz << 3) >> 3] | 0;
   break;
  case 70:
   HEAP32[sp + (lx << 3) >> 2] = +HEAPF64[sp + (ly << 3) >> 3] != +HEAPF64[sp + (lz << 3) >> 3] | 0;
   break;
  case 75:
   HEAP32[sp + (lx << 3) >> 2] = ~~+HEAPF64[sp + (ly << 3) >> 3];
   break;
  case 76:
   HEAPF64[sp + (lx << 3) >> 3] = +(HEAP32[sp + (ly << 3) >> 2] | 0);
   break;
  case 77:
   HEAPF64[sp + (lx << 3) >> 3] = +(HEAP32[sp + (ly << 3) >> 2] >>> 0);
   break;
  case 78:
   HEAP32[sp + (lx << 3) >> 2] = HEAP8[HEAP32[sp + (ly << 3) >> 2] >> 0];
   break;
  case 82:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[HEAP32[sp + (ly << 3) >> 2] >> 2];
   break;
  case 83:
   HEAP8[HEAP32[sp + (lx << 3) >> 2] >> 0] = HEAP32[sp + (ly << 3) >> 2] | 0;
   break;
  case 84:
   HEAP16[HEAP32[sp + (lx << 3) >> 2] >> 1] = HEAP32[sp + (ly << 3) >> 2] | 0;
   break;
  case 85:
   HEAP32[HEAP32[sp + (lx << 3) >> 2] >> 2] = HEAP32[sp + (ly << 3) >> 2] | 0;
   break;
  case 86:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[HEAP32[sp + (ly << 3) >> 2] >> 3];
   break;
  case 87:
   HEAPF64[HEAP32[sp + (lx << 3) >> 2] >> 3] = +HEAPF64[sp + (ly << 3) >> 3];
   break;
  case 90:
   HEAP32[sp + (lx << 3) >> 2] = HEAP8[(HEAP32[sp + (ly << 3) >> 2] | 0) + (HEAP32[sp + (lz << 3) >> 2] | 0) >> 0];
   break;
  case 97:
   HEAP32[(HEAP32[sp + (lx << 3) >> 2] | 0) + (HEAP32[sp + (ly << 3) >> 2] | 0) >> 2] = HEAP32[sp + (lz << 3) >> 2] | 0;
   break;
  case 106:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[(HEAP32[sp + (ly << 3) >> 2] | 0) + (inst >> 24) >> 2];
   break;
  case 107:
   HEAP8[(HEAP32[sp + (lx << 3) >> 2] | 0) + (ly << 24 >> 24) >> 0] = HEAP32[sp + (lz << 3) >> 2] | 0;
   break;
  case 109:
   HEAP32[(HEAP32[sp + (lx << 3) >> 2] | 0) + (ly << 24 >> 24) >> 2] = HEAP32[sp + (lz << 3) >> 2] | 0;
   break;
  case 119:
   pc = pc + (inst >> 16 << 2) | 0;
   pc = pc - 4 | 0;
   continue;
   break;
  case 120:
   if (HEAP32[sp + (lx << 3) >> 2] | 0) {
    pc = pc + (inst >> 16 << 2) | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 121:
   if (!(HEAP32[sp + (lx << 3) >> 2] | 0)) {
    pc = pc + (inst >> 16 << 2) | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 125:
   pc = pc + 4 | 0;
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] | 0 ? HEAP32[sp + (lz << 3) >> 2] | 0 : HEAP32[sp + ((HEAPU8[pc >> 0] | 0) << 3) >> 2] | 0;
   break;
  case 127:
   HEAP32[sp + (lx << 3) >> 2] = tempDoublePtr;
   break;
  case 128:
   HEAP32[sp + (lx << 3) >> 2] = tempRet0;
   break;
  case 129:
   tempRet0 = HEAP32[sp + (lx << 3) >> 2] | 0;
   break;
  case 130:
   switch (ly | 0) {
   case 0:
    {
     HEAP32[sp + (lx << 3) >> 2] = STACK_MAX;
     continue;
    }
   case 1:
    {
     HEAP32[sp + (lx << 3) >> 2] = cttz_i8;
     continue;
    }
   default:
    assert(0);
   }
   break;
  case 132:
   switch (inst >> 8 & 255) {
   case 0:
    {
     STACK_MAX = HEAP32[sp + (lz << 3) >> 2] | 0;
     continue;
    }
   case 1:
    {
     cttz_i8 = HEAP32[sp + (lz << 3) >> 2] | 0;
     continue;
    }
   default:
    assert(0);
   }
   break;
  case 134:
   lz = HEAPU8[(HEAP32[pc + 4 >> 2] | 0) + 1 | 0] | 0;
   ly = 0;
   assert((EMTSTACKTOP + 8 | 0) <= (EMT_STACK_MAX | 0) | 0);
   if ((asyncState | 0) != 2) {
    while ((ly | 0) < (lz | 0)) {
     HEAP32[EMTSTACKTOP + (ly << 3) + 8 >> 2] = HEAP32[sp + (HEAPU8[pc + 8 + ly >> 0] << 3) >> 2] | 0;
     HEAP32[EMTSTACKTOP + (ly << 3) + 12 >> 2] = HEAP32[sp + (HEAPU8[pc + 8 + ly >> 0] << 3) + 4 >> 2] | 0;
     ly = ly + 1 | 0;
    }
   }
   HEAP32[sp - 4 >> 2] = pc;
   emterpret(HEAP32[pc + 4 >> 2] | 0);
   if ((asyncState | 0) == 1) {
    EMTSTACKTOP = sp - 8 | 0;
    return;
   }
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[EMTSTACKTOP >> 2] | 0;
   HEAP32[sp + (lx << 3) + 4 >> 2] = HEAP32[EMTSTACKTOP + 4 >> 2] | 0;
   pc = pc + (4 + lz + 3 >> 2 << 2) | 0;
   break;
  case 135:
   switch (inst >>> 16 | 0) {
   case 0:
    {
     HEAP32[sp - 4 >> 2] = pc;
     abort();
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     continue;
    }
   case 1:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _bitshift64Shl(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 2:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _memset(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 3:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _bitshift64Lshr(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 4:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = Math_clz32(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 5:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___syscall146(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 6:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _pthread_cleanup_push(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 7:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _pthread_cleanup_pop(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 8:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = FUNCTION_TABLE_iiii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 7](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 9:
    {
     HEAP32[sp - 4 >> 2] = pc;
     FUNCTION_TABLE_viiiii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 7](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 8 | 0;
     continue;
    }
   case 10:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _memcpy(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 11:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___syscall140(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 12:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___syscall54(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 13:
    {
     HEAP32[sp - 4 >> 2] = pc;
     FUNCTION_TABLE_vi[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 7](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 14:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___syscall6(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 15:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _pthread_self() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     continue;
    }
   case 16:
    {
     HEAP32[sp - 4 >> 2] = pc;
     nullFunc_viiiii(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 17:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _emscripten_asm_const_v(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 18:
    {
     HEAP32[sp - 4 >> 2] = pc;
     nullFunc_iiii(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 19:
    {
     HEAP32[sp - 4 >> 2] = pc;
     nullFunc_ii(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 20:
    {
     HEAP32[sp - 4 >> 2] = pc;
     nullFunc_vi(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   default:
    assert(0);
   }
   break;
  case 136:
   HEAP32[sp + (lx << 3) >> 2] = STACKTOP;
   break;
  case 137:
   STACKTOP = HEAP32[sp + (lx << 3) >> 2] | 0;
   break;
  case 138:
   lz = HEAP32[sp + (lz << 3) >> 2] | 0;
   lx = (HEAP32[sp + (lx << 3) >> 2] | 0) - (HEAP32[sp + (ly << 3) >> 2] | 0) >>> 0;
   if (lx >>> 0 >= lz >>> 0) {
    pc = pc + (lz << 2) | 0;
    continue;
   }
   pc = HEAP32[pc + 4 + (lx << 2) >> 2] | 0;
   pc = pc - 4 | 0;
   continue;
   break;
  case 139:
   EMTSTACKTOP = sp - 8 | 0;
   HEAP32[EMTSTACKTOP >> 2] = HEAP32[sp + (lx << 3) >> 2] | 0;
   HEAP32[EMTSTACKTOP + 4 >> 2] = HEAP32[sp + (lx << 3) + 4 >> 2] | 0;
   return;
   break;
  case 141:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (inst >>> 16 << 3) >> 2] | 0;
   break;
  case 142:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[sp + (inst >>> 16 << 3) >> 3];
   break;
  case 143:
   HEAP32[sp + (inst >>> 16 << 3) >> 2] = HEAP32[sp + (lx << 3) >> 2] | 0;
   break;
  case 144:
   HEAPF64[sp + (inst >>> 16 << 3) >> 3] = +HEAPF64[sp + (lx << 3) >> 3];
   break;
  default:
   assert(0);
  }
 }
 assert(0);
}

function _memcpy(dest, src, num) {
 dest = dest | 0;
 src = src | 0;
 num = num | 0;
 var ret = 0;
 if ((num | 0) >= 4096) return _emscripten_memcpy_big(dest | 0, src | 0, num | 0) | 0;
 ret = dest | 0;
 if ((dest & 3) == (src & 3)) {
  while (dest & 3) {
   if ((num | 0) == 0) return ret | 0;
   HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
   dest = dest + 1 | 0;
   src = src + 1 | 0;
   num = num - 1 | 0;
  }
  while ((num | 0) >= 4) {
   HEAP32[dest >> 2] = HEAP32[src >> 2] | 0;
   dest = dest + 4 | 0;
   src = src + 4 | 0;
   num = num - 4 | 0;
  }
 }
 while ((num | 0) > 0) {
  HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
  dest = dest + 1 | 0;
  src = src + 1 | 0;
  num = num - 1 | 0;
 }
 return ret | 0;
}

function _memset(ptr, value, num) {
 ptr = ptr | 0;
 value = value | 0;
 num = num | 0;
 var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
 stop = ptr + num | 0;
 if ((num | 0) >= 20) {
  value = value & 255;
  unaligned = ptr & 3;
  value4 = value | value << 8 | value << 16 | value << 24;
  stop4 = stop & ~3;
  if (unaligned) {
   unaligned = ptr + 4 - unaligned | 0;
   while ((ptr | 0) < (unaligned | 0)) {
    HEAP8[ptr >> 0] = value;
    ptr = ptr + 1 | 0;
   }
  }
  while ((ptr | 0) < (stop4 | 0)) {
   HEAP32[ptr >> 2] = value4;
   ptr = ptr + 4 | 0;
  }
 }
 while ((ptr | 0) < (stop | 0)) {
  HEAP8[ptr >> 0] = value;
  ptr = ptr + 1 | 0;
 }
 return ptr - num | 0;
}

function _ceu_app_go($_ceu_app, $_ceu_evt, $_ceu_org, $_ceu_trl, $_ceu_stk) {
 $_ceu_app = $_ceu_app | 0;
 $_ceu_evt = $_ceu_evt | 0;
 $_ceu_org = $_ceu_org | 0;
 $_ceu_trl = $_ceu_trl | 0;
 $_ceu_stk = $_ceu_stk | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $_ceu_app;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $_ceu_evt;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $_ceu_org;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $_ceu_trl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $_ceu_stk;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 23516 | 0);
}

function copyTempDouble(ptr) {
 ptr = ptr | 0;
 HEAP8[tempDoublePtr >> 0] = HEAP8[ptr >> 0];
 HEAP8[tempDoublePtr + 1 >> 0] = HEAP8[ptr + 1 >> 0];
 HEAP8[tempDoublePtr + 2 >> 0] = HEAP8[ptr + 2 >> 0];
 HEAP8[tempDoublePtr + 3 >> 0] = HEAP8[ptr + 3 >> 0];
 HEAP8[tempDoublePtr + 4 >> 0] = HEAP8[ptr + 4 >> 0];
 HEAP8[tempDoublePtr + 5 >> 0] = HEAP8[ptr + 5 >> 0];
 HEAP8[tempDoublePtr + 6 >> 0] = HEAP8[ptr + 6 >> 0];
 HEAP8[tempDoublePtr + 7 >> 0] = HEAP8[ptr + 7 >> 0];
}

function runPostSets() {}
function _i64Subtract(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = a;
  HEAP32[EMTSTACKTOP + 16 >> 2] = b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = c;
  HEAP32[EMTSTACKTOP + 32 >> 2] = d;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 36284 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function b2(p0, p1, p2, p3, p4) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 p4 = p4 | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = p0;
  HEAP32[EMTSTACKTOP + 16 >> 2] = p1;
  HEAP32[EMTSTACKTOP + 24 >> 2] = p2;
  HEAP32[EMTSTACKTOP + 32 >> 2] = p3;
  HEAP32[EMTSTACKTOP + 40 >> 2] = p4;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 36492 | 0);
}

function _i64Add(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = a;
  HEAP32[EMTSTACKTOP + 16 >> 2] = b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = c;
  HEAP32[EMTSTACKTOP + 32 >> 2] = d;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 36404 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function ___stdio_seek($f, $off, $whence) {
 $f = $f | 0;
 $off = $off | 0;
 $whence = $whence | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $f;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $off;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $whence;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 33520 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function ___stdout_write($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $f;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $buf;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $len;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 34300 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function ___stdio_write($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $f;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $buf;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $len;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 19936 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function _bitshift64Ashr(low, high, bits) {
 low = low | 0;
 high = high | 0;
 bits = bits | 0;
 var ander = 0;
 asyncState ? abort(-12) | 0 : 0;
 if ((bits | 0) < 32) {
  ander = (1 << bits) - 1 | 0;
  tempRet0 = high >> bits;
  return low >>> bits | (high & ander) << 32 - bits;
 }
 tempRet0 = (high | 0) < 0 ? -1 : 0;
 return high >> bits - 32 | 0;
}

function _bitshift64Shl(low, high, bits) {
 low = low | 0;
 high = high | 0;
 bits = bits | 0;
 var ander = 0;
 asyncState ? abort(-12) | 0 : 0;
 if ((bits | 0) < 32) {
  ander = (1 << bits) - 1 | 0;
  tempRet0 = high << bits | (low & ander << 32 - bits) >>> 32 - bits;
  return low << bits;
 }
 tempRet0 = low << bits - 32;
 return 0;
}

function _bitshift64Lshr(low, high, bits) {
 low = low | 0;
 high = high | 0;
 bits = bits | 0;
 var ander = 0;
 asyncState ? abort(-12) | 0 : 0;
 if ((bits | 0) < 32) {
  ander = (1 << bits) - 1 | 0;
  tempRet0 = high >>> bits;
  return low >>> bits | (high & ander) << 32 - bits;
 }
 tempRet0 = 0;
 return high >>> bits - 32 | 0;
}

function b1(p0, p1, p2) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = p0;
  HEAP32[EMTSTACKTOP + 16 >> 2] = p1;
  HEAP32[EMTSTACKTOP + 24 >> 2] = p2;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 36608 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function establishStackSpace(stackBase, stackMax) {
 stackBase = stackBase | 0;
 stackMax = stackMax | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = stackBase;
  HEAP32[EMTSTACKTOP + 16 >> 2] = stackMax;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 36436 | 0);
}

function copyTempFloat(ptr) {
 ptr = ptr | 0;
 HEAP8[tempDoublePtr >> 0] = HEAP8[ptr >> 0];
 HEAP8[tempDoublePtr + 1 >> 0] = HEAP8[ptr + 1 >> 0];
 HEAP8[tempDoublePtr + 2 >> 0] = HEAP8[ptr + 2 >> 0];
 HEAP8[tempDoublePtr + 3 >> 0] = HEAP8[ptr + 3 >> 0];
}

function ___stdio_close($f) {
 $f = $f | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $f;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 35508 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function dynCall_viiiii(index, a1, a2, a3, a4, a5) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 a5 = a5 | 0;
 FUNCTION_TABLE_viiiii[index & 7](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0);
}

function b0(p0) {
 p0 = p0 | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = p0;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 36636 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function stackAlloc(size) {
 size = size | 0;
 var ret = 0;
 ret = STACKTOP;
 STACKTOP = STACKTOP + size | 0;
 STACKTOP = STACKTOP + 15 & -16;
 if ((STACKTOP | 0) >= (STACK_MAX | 0)) abort();
 return ret | 0;
}

function _ceu_app_init($app) {
 $app = $app | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $app;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 33692 | 0);
}

function _cleanup_89($p) {
 $p = $p | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $p;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 36320 | 0);
}

function b3(p0) {
 p0 = p0 | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = p0;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 36664 | 0);
}

function ___errno_location() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 36060 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function dynCall_iiii(index, a1, a2, a3) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 return FUNCTION_TABLE_iiii[index & 7](a1 | 0, a2 | 0, a3 | 0) | 0;
}

function _main() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 36516 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function setThrew(threw, value) {
 threw = threw | 0;
 value = value | 0;
 if ((__THREW__ | 0) == 0) {
  __THREW__ = threw;
  threwValue = value;
 }
}

function _update() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 36188 | 0);
}

function _begin() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 35192 | 0);
}

function dynCall_ii(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 return FUNCTION_TABLE_ii[index & 1](a1 | 0) | 0;
}

function dynCall_vi(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 FUNCTION_TABLE_vi[index & 7](a1 | 0);
}

function emtStackSave() {
 asyncState ? abort(-12) | 0 : 0;
 return EMTSTACKTOP | 0;
}

function getTempRet0() {
 asyncState ? abort(-12) | 0 : 0;
 return tempRet0 | 0;
}

function setTempRet0(value) {
 value = value | 0;
 tempRet0 = value;
}

function stackRestore(top) {
 top = top | 0;
 STACKTOP = top;
}

function emtStackRestore(x) {
 x = x | 0;
 EMTSTACKTOP = x;
}

function setAsyncState(x) {
 x = x | 0;
 asyncState = x;
}

function stackSave() {
 return STACKTOP | 0;
}

// EMSCRIPTEN_END_FUNCS

var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,b1,___stdout_write,___stdio_seek,b1,b1,___stdio_write,b1];
var FUNCTION_TABLE_viiiii = [b2,b2,b2,b2,_ceu_app_go,b2,b2,b2];
var FUNCTION_TABLE_vi = [b3,b3,b3,b3,b3,_ceu_app_init,b3,_cleanup_89];

  return { _i64Subtract: _i64Subtract, _update: _update, _free: _free, _main: _main, _i64Add: _i64Add, _memset: _memset, _malloc: _malloc, _memcpy: _memcpy, _bitshift64Lshr: _bitshift64Lshr, _begin: _begin, ___errno_location: ___errno_location, _bitshift64Shl: _bitshift64Shl, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, emterpret: emterpret, setAsyncState: setAsyncState, emtStackSave: emtStackSave, emtStackRestore: emtStackRestore, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, dynCall_viiiii: dynCall_viiiii, dynCall_vi: dynCall_vi };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Subtract.apply(null, arguments);
};

var real__update = asm["_update"]; asm["_update"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__update.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__free.apply(null, arguments);
};

var real__main = asm["_main"]; asm["_main"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__main.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Add.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__malloc.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"]; asm["_bitshift64Lshr"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__bitshift64Lshr.apply(null, arguments);
};

var real__begin = asm["_begin"]; asm["_begin"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__begin.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____errno_location.apply(null, arguments);
};

var real__bitshift64Shl = asm["_bitshift64Shl"]; asm["_bitshift64Shl"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__bitshift64Shl.apply(null, arguments);
};
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _update = Module["_update"] = asm["_update"];
var _free = Module["_free"] = asm["_free"];
var _main = Module["_main"] = asm["_main"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _memset = Module["_memset"] = asm["_memset"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _begin = Module["_begin"] = asm["_begin"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
;

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.establishStackSpace = asm['establishStackSpace'];

Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===




function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);

  var initialEmtStackTop = asm.emtStackSave();

  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      // an infinite loop keeps the C stack around, but the emterpreter stack must be unwound - we do not want to restore the call stack at infinite loop
      asm.emtStackRestore(initialEmtStackTop);
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    Module.printErr('run() called, but dependencies remain, so not running');
    return;
  }

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return; 

    ensureInitRuntime();

    preMain();

    if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
      Module.printErr('pre-main prep time: ' + (Date.now() - preloadStartTime) + ' ms');
    }

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') implicitly called by end of main(), but noExitRuntime, so not exiting the runtime (you can use emscripten_force_exit, if you want to force a true shutdown)');
    return;
  }

  if (Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') called, but noExitRuntime, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)');
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  } else if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}

Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}






// {{MODULE_ADDITIONS}}








