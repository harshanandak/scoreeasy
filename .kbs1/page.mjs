// node .kbe/page.mjs <state> <light|dark> <844|640>  -> the small html_preview page (synchronous load)
const [s = 'rest', theme = 'light', h = '844'] = process.argv.slice(2);
const carrier = 'E:/Personal-Projects/scoreeasy/.worktrees/kabaddi-explore-s1/.kbs1/carrier.png';
const bg = theme === 'dark' ? '#0b0b0d' : '#f4f5f7';
process.stdout.write(`<!doctype html><html${theme === 'dark' ? ' class="dark"' : ''}><head><meta charset="utf-8"><style>html,body{margin:0;background:${bg}}#root{position:relative;overflow:hidden}#root .sb-sheet-layer{position:absolute}#root .sb{min-height:0}</style></head><body><img id="c" alt="" src="${carrier}" style="display:none"><div id="root"></div><script>
window.__params='s=${s}&theme=${theme}&h=${h}';const H=${h};const U=['d','s','l',''].map(p=>p+'v'+'h').join('|');
try{localStorage.setItem('k','1')}catch(e){const m=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear(),key:i=>[...m.keys()][i]??null,get length(){return m.size}}})}
try{const src=document.getElementById('c').src;const bin=atob(src.slice(src.indexOf(',')+1));const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
const be=(p)=>((u[p]<<24)|(u[p+1]<<16)|(u[p+2]<<8)|u[p+3])>>>0;let p=8,W=0,parts=[],tot=0;while(p<u.length){const L=be(p),T=String.fromCharCode(u[p+4],u[p+5],u[p+6],u[p+7]);if(T==='IHDR')W=be(p+8);if(T==='IDAT'){parts.push(u.subarray(p+8,p+8+L));tot+=L}p+=12+L}
const z=new Uint8Array(tot);let o=0;for(const x of parts){z.set(x,o);o+=x.length}
const blocks=[];let q=2,rl=0;for(;;){const hd=z[q];const len=z[q+1]|(z[q+2]<<8);blocks.push(z.subarray(q+5,q+5+len));rl+=len;q+=5+len;if(hd&1)break}
const raw=new Uint8Array(rl);o=0;for(const x of blocks){raw.set(x,o);o+=x.length}
const stride=W*3+1,rows=rl/stride,d=new Uint8Array(rows*W*3);for(let y=0;y<rows;y++)d.set(raw.subarray(y*stride+1,(y+1)*stride),y*W*3);
const n=((d[0]<<24)|(d[1]<<16)|(d[2]<<8)|d[3])>>>0;const pl=JSON.parse(new TextDecoder().decode(d.subarray(4,4+n)));
const st=document.createElement('style');st.textContent=pl.fonts+String.fromCharCode(10)+pl.css.replace(new RegExp('([0-9]+(?:[.][0-9]+)?)(?:'+U+')(?![a-z])','g'),(_,v)=>(v*H/100)+'px').replace(new RegExp('[(](max|min)-height:[ ]*([0-9.]+)px[)]','g'),(_,k,v)=>((k==='max'?H<=+v:H>=+v)?'(min-width: 0px)':'(max-width: 0px)'));document.head.append(st);
document.getElementById('root').style.height=H+'px';(0,eval)(pl.js)}catch(e){console.log('ERR',e.message,(e.stack||'').slice(0,400))}
</script></body></html>`);
