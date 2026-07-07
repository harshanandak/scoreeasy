
class Component extends DCLogic {
  componentDidMount(){ this._tagPhones(); this._loadFonts(); this._apply(); this._applyTheme(); }
  _loadFonts(){ if(document.getElementById('se-brand-fonts'))return; var l=document.createElement('link'); l.id='se-brand-fonts'; l.rel='stylesheet'; l.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap'; document.head.appendChild(l); }
  componentDidUpdate(){ this._apply(); this._applyTheme(); }
  _tagPhones(){ [].forEach.call(document.querySelectorAll('div'), function(d){ if(d.offsetWidth===300 && d.offsetHeight===600 && /^34/.test(getComputedStyle(d).borderRadius)) d.setAttribute('data-se-phone',''); }); }
  _apply(){
    const g = (this.props.game) || 'all';
    document.querySelectorAll('[data-game]').forEach(function(el){
      const gg = el.getAttribute('data-game');
      el.style.display = (g === 'all' || gg === 'generic' || gg === g) ? '' : 'none';
    });
  }
  _applyTheme(){
    var brand = false; var bal = true; var styled = true;
    [].forEach.call(document.querySelectorAll('[data-se-phone]'), function(p){
      if(p.dataset.seOrig){ var op=JSON.parse(p.dataset.seOrig); p.style.border=op.b; p.style.boxShadow=op.s; p.style.borderRadius=op.r; delete p.dataset.seOrig; }
      if(styled){ if(!p.dataset.seOrig){ p.dataset.seOrig = JSON.stringify({b:p.style.border, s:p.style.boxShadow, r:p.style.borderRadius}); } if(brand){ p.style.border='1.5px solid #0a0a0a'; p.style.boxShadow='3px 3px 0px -1px rgba(0,0,0,1), 3px 6px 8px -3px rgba(0,0,0,0.9)'; p.style.borderRadius='10px'; } else { p.style.border=''; p.style.boxShadow='0 18px 42px -22px rgba(16,90,55,0.5), 0 2px 6px rgba(20,40,30,0.06)'; p.style.borderRadius='32px'; } }
      else if(p.dataset.seOrig){ var o=JSON.parse(p.dataset.seOrig); p.style.border=o.b; p.style.boxShadow=o.s; p.style.borderRadius=o.r; delete p.dataset.seOrig; }
    });
    [].forEach.call(document.querySelectorAll('[data-se-phone] *'), function(el){
      if(el.dataset.seO){ var oo=JSON.parse(el.dataset.seO); el.style.fontFamily=oo.f; el.style.boxShadow=oo.s; el.style.borderRadius=oo.r; el.style.border=oo.b; el.style.background=oo.g; el.style.color=oo.c; delete el.dataset.seO; }
      if(styled){
        if(!el.dataset.seO){ el.dataset.seO = JSON.stringify({f:el.style.fontFamily,s:el.style.boxShadow,r:el.style.borderRadius,b:el.style.border,g:el.style.background,c:el.style.color}); }
        if(brand){ var cf=el.style.fontFamily; if(cf){ el.style.fontFamily = /mono/i.test(cf) ? "'JetBrains Mono', ui-monospace, monospace" : "'Inter', system-ui, sans-serif"; } }
        var gb=el.style.background; if(gb){ if(/gradient/.test(gb)){ if(brand){ el.style.background='#199a52'; } } else if(/rgb\(18, 147, 106\)|#12936a/i.test(gb)){ el.style.background = brand ? '#199a52' : '#1aa75e'; } else if(/e7f4ee|231, 244, 238/i.test(gb)){ el.style.background='#e6f3ea'; } }
        if(el.style.boxShadow && el.style.boxShadow!=='none'){ el.style.boxShadow = brand ? '3px 3px 0px -1px rgba(0,0,0,0.5)' : ((/gradient/.test(el.style.background||'')||/199a52|1aa75e|26, 167, 94|25, 154, 82|18, 147, 106|12936a/i.test(el.style.background||'')) ? '0 10px 22px -12px rgba(16,90,55,0.4)' : 'none'); }
        if(brand){ var cr=parseFloat(el.style.borderRadius); if(cr>=8 && cr<40){ el.style.borderRadius='8px'; } }
        var bg=el.style.background||''; var hasBg = bg && !/^(none|transparent|rgba\(0, 0, 0, 0\))/.test(bg); if(hasBg && !el.style.border && el.offsetWidth>44 && el.offsetHeight>26){ var grad=/gradient/.test(bg); el.style.border = brand ? (grad ? '1.5px solid #0c0c0c' : '1.25px solid rgba(12,12,12,0.82)') : ((grad||/199a52|1aa75e|18, 147, 106|12936a/i.test(bg)) ? '' : '1px solid rgba(20,120,72,0.09)'); }
      } else if(el.dataset.seO){ var o=JSON.parse(el.dataset.seO); el.style.fontFamily=o.f; el.style.boxShadow=o.s; el.style.borderRadius=o.r; el.style.border=o.b; el.style.background=o.g; el.style.color=o.c; delete el.dataset.seO; }
    });
    if(document.body) document.body.style.background = brand ? '#f3f6f1' : (bal ? '#f1f5f1' : '');
  }
  renderVals(){
    const style = this.props.uiStyle ?? 'refined';
    return {
      showRefined: style === 'refined',
      showNew: style === 'new',
      showOld: style === 'old',
    };
  }
}