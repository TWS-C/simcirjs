function initSimcirUtilityFunctions()
{
    let debug = location.hash == '#debug';

    let cacheIdKey = '.lessqCacheId';
    let cacheIdSeq = 0;
    let cache      = {};

    let getCache = function (element)
    {
        let cacheId = element[cacheIdKey];

        if (typeof cacheId == 'undefined')
        {
            element[cacheIdKey] = cacheId = cacheIdSeq++;
            cache[cacheId]                = debug ? {e: element} : {};
        }
        return cache[cacheId];
    };

    let hasCache = function (elm)
    {
        return typeof elm[cacheIdKey] != 'undefined';
    };

    if (debug)
    {
        let lastKeys       = {};
        let showCacheCount = function ()
        {
            let cnt  = 0;
            let keys = {};
            for (let k in cache)
            {
                cnt += 1;
                if (!lastKeys[k])
                {
                    console.log(cache[k]);
                }
                keys[k] = true;
            }
            lastKeys = keys;
            console.log('cacheCount:' + cnt);
            window.setTimeout(showCacheCount, 5000);
        };
        showCacheCount();
    }

    let removeCache = function (elm)
    {

        if (typeof elm[cacheIdKey] != 'undefined')
        {
            // remove all listeners
            let cacheId     = elm[cacheIdKey];
            let listenerMap = cache[cacheId].listenerMap;
            for (let type in listenerMap)
            {
                let listeners = listenerMap[type];
                for (let i = 0; i < listeners.length; i += 1)
                {
                    elm.removeEventListener(type, listeners[i]);
                }
            }

            // delete refs
            delete elm[cacheIdKey];
            delete cache[cacheId];
        }

        while (elm.firstChild)
        {
            removeCache(elm.firstChild);
            elm.removeChild(elm.firstChild);
        }
    };

    let getData = function (element)
    {
        if (!getCache(element).data)
        {
            getCache(element).data = {};
        }

        return getCache(element).data;
    };

    let getListeners = function (elm, type)
    {
        if (!getCache(elm).listenerMap)
        {
            getCache(elm).listenerMap = {};
        }
        if (!getCache(elm).listenerMap[type])
        {
            getCache(elm).listenerMap[type] = [];
        }
        return getCache(elm).listenerMap[type];
    };

    // add / remove event listener.
    let addEventListener = function (elm, type, listener, add)
    {
        let listeners    = getListeners(elm, type);
        let newListeners = [];
        for (let i = 0; i < listeners.length; i += 1)
        {
            if (listeners[i] != listener)
            {
                newListeners.push(listeners[i]);
            }
        }
        if (add)
        {
            newListeners.push(listener);
        }
        getCache(elm).listenerMap[type] = newListeners;
        return true;
    };

    let CustomEvent = {
        preventDefault:           function ()
                                  {
                                      this._pD = true;
                                  },
        stopPropagation:          function ()
                                  {
                                      this._sP = true;
                                  },
        stopImmediatePropagation: function ()
                                  {
                                      this._sIp = true;
                                  },
    };

    let trigger = function (elm, type, data)
    {
        let event = {
            type:          type,
            target:        elm,
            currentTarget: null,
            _pD:           false,
            _sP:           false,
            _sIp:          false,
            __proto__:     CustomEvent,
        };
        for (let e = elm; e != null; e = e.parentNode)
        {
            if (!hasCache(e))
            {
                continue;
            }
            if (!getCache(e).listenerMap)
            {
                continue;
            }
            if (!getCache(e).listenerMap[type])
            {
                continue;
            }
            event.currentTarget = e;
            let listeners       = getCache(e).listenerMap[type];
            for (let i = 0; i < listeners.length; i += 1)
            {
                listeners[i].call(e, event, data);
                if (event._sIp)
                {
                    return;
                }
            }
            if (event._sP)
            {
                return;
            }
        }
    };

    let data = function (elm, kv)
    {
        if (arguments.length == 2)
        {
            if (typeof kv == 'string')
            {
                return getData(elm)[kv];
            }
            for (let k in kv)
            {
                getData(elm)[k] = kv[k];
            }
        }
        else if (arguments.length == 3)
        {
            getData(elm)[kv] = arguments[2];
        }
        return elm;
    };

    let extend = function (o1, o2)
    {
        for (let k in o2)
        {
            o1[k] = o2[k];
        }
        return o1;
    };

    let each = function (it, callback)
    {
        if (typeof it.splice == 'function')
        {
            for (let i = 0; i < it.length; i += 1)
            {
                callback(i, it[i]);
            }
        }
        else
        {
            for (let k in it)
            {
                callback(k, it[k]);
            }
        }
    };

    let grep = function (list, accept)
    {
        let newList = [];
        for (let i = 0; i < list.length; i += 1)
        {
            let item = list[i];
            if (accept(item))
            {
                newList.push(item);
            }
        }
        return newList;
    };

    let addClass = function (elm, className, add)
    {
        let classes    = (elm.getAttribute('class') || '').split(/\s+/g);
        let newClasses = '';
        for (let i = 0; i < classes.length; i += 1)
        {
            if (classes[i] == className)
            {
                continue;
            }
            newClasses += ' ' + classes[i];
        }
        if (add)
        {
            newClasses += ' ' + className;
        }
        elm.setAttribute('class', newClasses);
    };

    let hasClass = function (elm, className)
    {
        let classes = (elm.getAttribute('class') || '').split(/\s+/g);
        for (let i = 0; i < classes.length; i += 1)
        {
            if (classes[i] == className)
            {
                return true;
            }
        }
        return false;
    };

    let matches = function (elm, selector)
    {
        if (elm.nodeType != 1)
        {
            return false;
        }
        else if (!selector)
        {
            return true;
        }
        let sels = selector.split(/[,\s]+/g);
        for (let i = 0; i < sels.length; i += 1)
        {
            let sel = sels[i];
            if (sel.substring(0, 1) == '#')
            {
                throw 'not supported:' + sel;
            }
            else if (sel.substring(0, 1) == '.')
            {
                if (hasClass(elm, sel.substring(1)))
                {
                    return true;
                }
            }
            else
            {
                if (elm.tagName.toUpperCase() == sel.toUpperCase())
                {
                    return true;
                }
            }
        }
        return false;
    };

    let parser = new window.DOMParser();

    let html = function (html)
    {
        let doc  = parser.parseFromString(
            '<div xmlns="http://www.w3.org/1999/xhtml">' + html + '</div>',
            'text/xml',
        ).firstChild;
        let elms = [];
        while (doc.firstChild)
        {
            elms.push(doc.firstChild);
            doc.removeChild(doc.firstChild);
        }
        elms.__proto__ = fn;
        return elms;
    };

    let pxToNum = function (px)
    {
        if (typeof px != 'string' || px.length <= 2 ||
            px.charAt(px.length - 2) != 'p' ||
            px.charAt(px.length - 1) != 'x')
        {
            throw 'illegal px:' + px;
        }
        return +px.substring(0, px.length - 2);
    };

    let buildQuery = function (data)
    {
        let query = '';
        for (let k in data)
        {
            if (query.length > 0)
            {
                query += '&';
            }
            query += window.encodeURIComponent(k);
            query += '=';
            query += window.encodeURIComponent(data[k]);
        }
        return query;
    };

    let parseResponse = function ()
    {

        let contentType = this.getResponseHeader('content-type');
        if (contentType != null)
        {
            contentType = contentType.replace(/\s*;.+$/, '').toLowerCase();
        }

        if (contentType == 'text/xml' ||
            contentType == 'application/xml')
        {
            return parser.parseFromString(this.responseText, 'text/xml');
        }
        else if (contentType == 'text/json' ||
            contentType == 'application/json')
        {
            return JSON.parse(this.responseText);
        }
        else
        {
            return this.response;
        }
    };

    let ajax = function (params)
    {
        params = extend(
            {
                url:         '',
                method:      'GET',
                contentType: 'application/x-www-form-urlencoded;charset=UTF-8',
                cache:       true,
                processData: true,
                async:       true,
            },
            params
        );

        if (!params.async)
        {
            // force async.
            throw 'not supported.';
        }

        let method      = params.method.toUpperCase();
        let data        = null;
        let contentType = params.contentType;
        if (method == 'POST' || method == 'PUT')
        {
            data = (typeof params.data == 'object' && params.processData) ?
                buildQuery(params.data) : params.data;
        }
        else
        {
            contentType = false;
        }

        let xhr = params.xhr ? params.xhr() : new window.XMLHttpRequest();

        xhr.open(method, params.url, params.async);
        if (contentType !== false)
        {
            xhr.setRequestHeader('Content-Type', contentType);
        }
        xhr.onreadystatechange = function ()
        {
            if (xhr.readyState != window.XMLHttpRequest.DONE)
            {
                return;
            }
            try
            {
                if (xhr.status == 200)
                {
                    done.call(xhr, parseResponse.call(this));
                }
                else
                {
                    fail.call(xhr);
                }
            } finally
            {
                always.call(xhr);
            }
        };

        // call later
        window.setTimeout(function ()
        {
            xhr.send(data);
        }, 0);

        // callbacks
        let done   = function (data)
        {
        };
        let fail   = function ()
        {
        };
        let always = function ()
        {
        };

        let $ = {
            done:   function (callback)
                    {
                        done = callback;
                        return $;
                    },
            fail:   function (callback)
                    {
                        fail = callback;
                        return $;
                    },
            always: function (callback)
                    {
                        always = callback;
                        return $;
                    },
            abort:  function ()
                    {
                        xhr.abort();
                        return $;
                    },
        };
        return $;
    };

    // 1. for single element
    let fn = {
        attr:         function (kv)
                      {
                          if (arguments.length == 1)
                          {
                              if (typeof kv == 'string')
                              {
                                  return this.getAttribute(kv);
                              }
                              for (let k in kv)
                              {
                                  this.setAttribute(k, kv[k]);
                              }
                          }
                          else if (arguments.length == 2)
                          {
                              this.setAttribute(kv, arguments[1]);
                          }
                          return this;
                      },
        prop:         function (kv)
                      {
                          if (arguments.length == 1)
                          {
                              if (typeof kv == 'string')
                              {
                                  return this[kv];
                              }
                              for (let k in kv)
                              {
                                  this[k] = kv[k];
                              }
                          }
                          else if (arguments.length == 2)
                          {
                              this[kv] = arguments[1];
                          }
                          return this;
                      },
        css:          function (kv)
                      {
                          if (arguments.length == 1)
                          {
                              if (typeof kv == 'string')
                              {
                                  return this.style[kv];
                              }
                              for (let k in kv)
                              {
                                  this.style[k] = kv[k];
                              }
                          }
                          else if (arguments.length == 2)
                          {
                              this.style[kv] = arguments[1];
                          }
                          return this;
                      },
        data:         function (kv)
                      {
                          let args = [this];
                          for (let i = 0; i < arguments.length; i += 1)
                          {
                              args.push(arguments[i]);
                          }
                          return data.apply(null, args);
                      },
        val:          function ()
                      {
                          if (arguments.length == 0)
                          {
                              return this.value || '';
                          }
                          else if (arguments.length == 1)
                          {
                              this.value = arguments[0];
                          }
                          return this;
                      },
        on:           function (type, listener)
                      {
                          let types = type.split(/\s+/g);
                          for (let i = 0; i < types.length; i += 1)
                          {
                              this.addEventListener(types[i], listener);
                              addEventListener(this, types[i], listener, true);
                          }
                          return this;
                      },
        off:          function (type, listener)
                      {
                          let types = type.split(/\s+/g);
                          for (let i = 0; i < types.length; i += 1)
                          {
                              this.removeEventListener(types[i], listener);
                              addEventListener(this, types[i], listener, false);
                          }
                          return this;
                      },
        trigger:      function (type, data)
                      {
                          trigger(this, type, data);
                          return this;
                      },
        offset:       function ()
                      {
                          let off  = {
                              left: 0,
                              top:  0,
                          };
                          let base = null;

                          for (let e = this; e.parentNode != null; e = e.parentNode)
                          {
                              if (e.offsetParent != null)
                              {
                                  base = e;
                                  break;
                              }
                          }

                          if (base != null)
                          {
                              for (let e = base; e.offsetParent != null; e = e.offsetParent)
                              {
                                  off.left += e.offsetLeft;
                                  off.top  += e.offsetTop;
                              }
                          }

                          for (let e = this; e.parentNode != null && e != document.body; e = e.parentNode)
                          {
                              off.left -= e.scrollLeft;
                              off.top  -= e.scrollTop;
                          }

                          return off;
                      },
        append:       function (elms)
                      {
                          if (typeof elms == 'string')
                          {
                              elms = html(elms);
                          }
                          for (let i = 0; i < elms.length; i += 1)
                          {
                              this.appendChild(elms[i]);
                          }
                          return this;
                      },
        prepend:      function (elms)
                      {
                          if (typeof elms == 'string')
                          {
                              elms = html(elms);
                          }
                          for (let i = 0; i < elms.length; i += 1)
                          {
                              if (this.firstChild)
                              {
                                  this.insertBefore(elms[i], this.firstChild);
                              }
                              else
                              {
                                  this.appendChild(elms[i]);
                              }
                          }
                          return this;
                      },
        insertBefore: function (elms)
                      {
                          let elm = elms[0];
                          elm.parentNode.insertBefore(this, elm);
                          return this;
                      },
        insertAfter:  function (elms)
                      {
                          let elm = elms[0];
                          if (elm.nextSibling)
                          {
                              elm.parentNode.insertBefore(this, elm.nextSibling);
                          }
                          else
                          {
                              elm.parentNode.appendChild(this);
                          }
                          return this;
                      },
        remove:       function ()
                      {
                          if (this.parentNode)
                          {
                              this.parentNode.removeChild(this);
                          }
                          removeCache(this);
                          return this;
                      },
        detach:       function ()
                      {
                          if (this.parentNode)
                          {
                              this.parentNode.removeChild(this);
                          }
                          return this;
                      },
        parent:       function ()
                      {
                          return $(this.parentNode);
                      },
        closest:      function (selector)
                      {
                          for (let e = this; e != null; e = e.parentNode)
                          {
                              if (matches(e, selector))
                              {
                                  return $(e);
                              }
                          }
                          return $();
                      },
        find:         function (selector)
                      {
                          let elms       = [];
                          let childNodes = this.querySelectorAll(selector);
                          for (let i = 0; i < childNodes.length; i += 1)
                          {
                              elms.push(childNodes.item(i));
                          }
                          elms.__proto__ = fn;
                          return elms;
                      },
        children:     function (selector)
                      {
                          let elms       = [];
                          let childNodes = this.childNodes;
                          for (let i = 0; i < childNodes.length; i += 1)
                          {
                              if (matches(childNodes.item(i), selector))
                              {
                                  elms.push(childNodes.item(i));
                              }
                          }
                          elms.__proto__ = fn;
                          return elms;
                      },
        index:        function (selector)
                      {
                          return Array.prototype.indexOf.call(
                              $(this).parent().children(selector), this);
                      },
        clone:        function ()
                      {
                          return $(this.cloneNode(true));
                      },
        focus:        function ()
                      {
                          this.focus();
                          return this;
                      },
        select:       function ()
                      {
                          this.select();
                          return this;
                      },
        submit:       function ()
                      {
                          this.submit();
                          return this;
                      },
        scrollLeft:   function ()
                      {
                          if (arguments.length == 0)
                          {
                              return this.scrollLeft;
                          }
                          this.scrollLeft = arguments[0];
                          return this;
                      },
        scrollTop:    function ()
                      {
                          if (arguments.length == 0)
                          {
                              return this.scrollTop;
                          }
                          this.scrollTop = arguments[0];
                          return this;
                      },
        html:         function ()
                      {
                          if (arguments.length == 0)
                          {
                              return this.innerHTML;
                          }
                          this.innerHTML = arguments[0];
                          return this;
                      },
        text:         function ()
                      {
                          if (typeof this.textContent != 'undefined')
                          {
                              if (arguments.length == 0)
                              {
                                  return this.textContent;
                              }
                              this.textContent = arguments[0];
                              return this;
                          }
                          else
                          {
                              if (arguments.length == 0)
                              {
                                  return this.innerText;
                              }
                              this.innerText = arguments[0];
                              return this;
                          }
                      },
        outerWidth:   function (margin)
                      {
                          let w = this.offsetWidth;
                          if (margin)
                          {
                              let cs = window.getComputedStyle(this, null);
                              return w + pxToNum(cs.marginLeft) + pxToNum(cs.marginRight);
                          }
                          return w;
                      },
        innerWidth:   function ()
                      {
                          let cs = window.getComputedStyle(this, null);
                          return this.offsetWidth -
                              pxToNum(cs.borderLeftWidth) - pxToNum(cs.borderRightWidth);
                      },
        width:        function ()
                      {
                          if (this == window)
                          {
                              return this.innerWidth;
                          }
                          let cs = window.getComputedStyle(this, null);
                          return this.offsetWidth -
                              pxToNum(cs.borderLeftWidth) - pxToNum(cs.borderRightWidth) -
                              pxToNum(cs.paddingLeft) - pxToNum(cs.paddingRight);
                      },
        outerHeight:  function (margin)
                      {
                          let h = this.offsetHeight;
                          if (margin)
                          {
                              let cs = window.getComputedStyle(this, null);
                              return h + pxToNum(cs.marginTop) + pxToNum(cs.marginBottom);
                          }
                          return h;
                      },
        innerHeight:  function ()
                      {
                          let cs = window.getComputedStyle(this, null);
                          return this.offsetHeight -
                              pxToNum(cs.borderTopWidth) - pxToNum(cs.borderBottomWidth);
                      },
        height:       function ()
                      {
                          if (this == window)
                          {
                              return this.innerHeight;
                          }
                          let cs = window.getComputedStyle(this, null);
                          return this.offsetHeight -
                              pxToNum(cs.borderTopWidth) - pxToNum(cs.borderBottomWidth) -
                              pxToNum(cs.paddingTop) - pxToNum(cs.paddingBottom);
                      },
        addClass:     function (className)
                      {
                          addClass(this, className, true);
                          return this;
                      },
        removeClass:  function (className)
                      {
                          addClass(this, className, false);
                          return this;
                      },
        hasClass:     function (className)
                      {
                          return hasClass(this, className);
                      },
    };

    // 2. to array
    each(fn, function (name, func)
    {
        fn[name] = function ()
        {
            let newRet = null;
            for (let i = 0; i < this.length; i += 1)
            {
                let elm = this[i];
                let ret = func.apply(elm, arguments);
                if (elm !== ret)
                {
                    if (ret != null && ret.__proto__ == fn)
                    {
                        if (newRet == null)
                        {
                            newRet = [];
                        }
                        newRet = newRet.concat(ret);
                    }
                    else
                    {
                        return ret;
                    }
                }
            }
            if (newRet != null)
            {
                newRet.__proto__ = fn;
                return newRet;
            }
            return this;
        };
    });

    // 3. for array
    fn = extend(fn, {
        each:  function (callback)
               {
                   for (let i = 0; i < this.length; i += 1)
                   {
                       callback.call(this[i], i);
                   }
                   return this;
               },
        first: function ()
               {
                   return $(this.length > 0 ? this[0] : null);
               },
        last:  function ()
               {
                   return $(this.length > 0 ? this[this.length - 1] : null);
               },
    });

    let $ = function (target)
    {
        if (typeof target == 'function')
        {
            // ready
            return $(document).on('DOMContentLoaded', target);
        }
        else if (typeof target == 'string')
        {
            if (target.charAt(0) == '<')
            {
                // dom creation
                return html(target);
            }
            else
            {
                // query
                let childNodes = document.querySelectorAll(target);
                let elms       = [];
                for (let i = 0; i < childNodes.length; i += 1)
                {
                    elms.push(childNodes.item(i));
                }
                elms.__proto__ = fn;
                return elms;
            }
        }
        else if (typeof target == 'object' && target != null)
        {
            if (target.__proto__ == fn)
            {
                return target;
            }
            else
            {
                let elms = [];
                elms.push(target);
                elms.__proto__ = fn;
                return elms;
            }
        }
        else
        {
            let elms       = [];
            elms.__proto__ = fn;
            return elms;
        }
    };

    return extend(
        $,
        {
            fn:     fn,
            extend: extend,
            each:   each,
            grep:   grep,
            data:   data,
            ajax:   ajax,
        }
    );
}
