/*
 * fis
 * http://fis.baidu.com/
 */

'use strict';

//Object Rules
var Rules = Object.derive(function (id, css) {
    var self = this
        , _ = fis.util
        , __size_re = /(?:\/\*[\s\S]*?(?:\*\/|$))|\bwidth:\s*?([\d\.]+)(px|rem)\s*?(?:\}|;|$)|height:\s*?([\d\.]+)(px|rem)\s*?(?:\}|;|$)/g
        , __units_re = /\d+(px|rem)/i //尺寸单位
        , __background_re = /(?:\/\*[\s\S]*?(?:\*\/|$))|\bbackground(?:-image)?:([\s\S]*?)(?:\}|;|$)|background-position:([\s\S]*?)(?:\}|;|$)|(?:[^\{\};]*)background-repeat:([\s\S]*?)(?:\}|;|$)|(?:[^\{\};]*)background-size:([\s\S]*?)(?:\}|;|$)/gi
        , __image_url_re = /url\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|[^)}]+)\s*\)/i
        , __support_position_re = /(0|[+-]?(?:\d*\.|)\d+px|left|right)\s+(0|[+-]?(?:\d*\.|)\d+px|top)/i
        , __support_size_re = /([\d\.]+)(px|rem)\s*([\d\.]+)(px|rem)/i //支持px、rem
        , __color_re = /((?:^|\s)#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|\btransparent|\b(?:rgba?|hsla?)\([\s\S]*?\))/i
        , __repeat_re = /\brepeat-(x|y)/i
        , __sprites_re = /([?&])__sprite=?([a-z0-9_-]+)?(&)?/i  // 支持分组合并，多参数
        , __sprites_hook_ld = '<<<'
        , __sprites_hook_rd = '>>>';
    //selectors
    self.id = id;
    //use image url
    self.image = '';
    self.repeat = false;
    self.color = false;
    self.size = [-1, -1];
    self.units = '';

    self._position = [0, 0];
    //image has __sprite query ?
    self._is_sprites = false;
    //group
    self._group = '__default__';
    //x,y,z
    self._direct = 'z';
    //left or right
    self._type = null;
    self._have_position = false;

    //获取spriter的配置
    self._settings = fis.config.get('settings.spriter.csssprites');
    /**
     * get position
     * @param res
     * @private
     */
    function _get_position(res) {
        if (!res[1] || !res[2]) {
            return;
        }
        self._have_position = true;
        if (['left', 'right'].indexOf(res[1]) != -1) {
            //left 和 right 都靠右排，so 类型都为`left`
            self._type = 'left';
            self._position[0] = (res[1] == 'left') ? 0 : res[1];
        } else {
            self._position[0] = parseFloat(res[1]);
        }
        self._position[1] = res[2] === 'top' ? 0 : parseFloat(res[2]);
    }

    function _get_contain_size() {
        var tmpUnit = ['', ''];
        css.replace(__size_re, function(sizeM, width, widthUnit, height, heightUnit) {
            if(width) {
                self.size[0] = parseFloat(width);
                tmpUnit[0] = widthUnit;
            }
            if(height) {
                self.size[1] = parseFloat(height);
                tmpUnit[1] = heightUnit;
            }
        });
        if(tmpUnit[0]!='' && tmpUnit[0]==tmpUnit[1]) {
            self.units = tmpUnit[0];
        }else{
            self.size = [-1, -1];
        }
    }

    self._css = css.replace(__background_re,
        function(m, image, position, repeat, size) {
            var res, info;
            if (image) {
                //get the url of image
                res = image.match(__image_url_re);
                if (res && res[1]) {
                    info = _.stringQuote(res[1]);
                    info = _.query(info.rest);
                    // 图片分组合并支持
                    self.image = info.origin.replace(__sprites_re, function (value, first, group, last) {
                        self._group = group ? group : '__default__';
                        if (first === '?') {
                            if (last === '&') {
                                return first;
                            }else{
                                return '';
                            }
                        } else {
                            return last ? last : '';
                        }
                    });

                    if (info.query && __sprites_re.test(info.query)) {
                        self._is_sprites = true;
                    }
                }
                //judge repeat-x or repeat-y
                res = image.match(__repeat_re);
                if (res) {
                    self.repeat = res[1].trim();
                    self._direct = res[1].trim()
                }
                //if set position then get it.
                res = image.match(__support_position_re);
                if (res) {
                    _get_position(res);
                }
                // color
                res = image.match(__color_re);
                if(res) {
                    self.color = res[1].trim();
                }
            }
            if (position) {
                //if use background-position, get it.
                res = position.match(__support_position_re);
                if (res) {
                    _get_position(res);
                }
            }
            if (repeat) {
                res = repeat.match(__repeat_re);
                if (res) {
                    self.repeat = res[1].trim();
                    self._direct = res[1];
                }
            }

            if (size) {
                res = size.match(__support_size_re);
                if (res) {
                    self.size[0] = parseFloat(res[1]);
                    self.size[1] = parseFloat(res[3]);
                    self.units = res[2];
                }else if(size.trim()=='contain') {
                    _get_contain_size();
                }
            }
            return __sprites_hook_ld + m + __sprites_hook_rd;
        }
    );
}, {
    getId: function() {
        return this.id;
    },
    getImageUrl: function() {
        return this.image;
    },
    getCss: function() {
        var __sprites_hook_re = /<<<[\s\S]*?>>>/g
            , ret = this._css;
        //if use sprites, replace background-image + background-position to space;
        if (this.isSprites()) {
            ret = ret.replace(__sprites_hook_re, '').trim();
            //压缩会去掉最后一个;所以最前面加一个;
            var pre_pad = '';
            if (ret.length > 0 && ret.charAt(ret.length - 1) != ';') {
                pre_pad = ';';
            }
            if (this.repeat) {
                ret += pre_pad + 'background-repeat: repeat-' + this.repeat +';';
            } else {
                ret += pre_pad + 'background-repeat: no-repeat;';
            }
            if(this.color) {
                ret += 'background-color:'+ this.color +';';
            }
        }
        return ret;
    },
    isSprites: function() {
        return this._is_sprites;
    },
    setType: function(type) {
        this._type = type;
    },
    getType: function() {
        return this._type;
    },
    getGroup: function() {
        return this._group;
    },
    getDirect: function() {
        return this._direct;
    },
    getPosition: function() {
        return this._position;
    },
    havePosition: function() {
        return this._have_position;
    }
});

module.exports = Rules.factory();
module.exports.wrap = function (id, css) {
    if(typeof id === 'string') {
        return new Rules(id, css);
    } else if(id instanceof Rules){
        return id;
    } else {
        fis.log.error('unable to convert [' + (typeof id) + '] to [Rules] object.');
    }
};
