// Read-only snapshot of /phonics on 2026-10-23. Test fixture only: production uses fetchPhonicsBank.
// Braces transcribe the highlighted spans visible on the source screen, not inferred string replacements.
const stages = {
  4: {
    'L-Blends (bl)': '{bl}ouse {bl}ack {bl}ock', 'L-Blends (cl)': '{cl}ap {cl}ock {cl}ub',
    'L-Blends (fl)': '{fl}ag {fl}at', 'L-Blends (gl)': '{gl}ass {gl}ad', 'L-Blends (pl)': '{pl}ant {pl}an',
    'R-Blends (br)': '{br}ead {br}ush', 'R-Blends (cr)': '{cr}ab {cr}oss', 'R-Blends (dr)': '{dr}um {dr}op',
    'R-Blends (fr)': '{fr}og {fr}ame', 'R-Blends (gr)': '{gr}ape {gr}ass', 'R-Blends (pr)': '{pr}int {pr}ess',
    'R-Blends (tr)': '{tr}ain {tr}uck', 'S-Blends (st)': '{st}op {st}ar {st}em {st}ep', 'S-Blends (sk)': '{sk}in {sk}ip',
    'Final Blend (sk)': 'de{sk} ma{sk}', 'Final Blend (mp)': 'la{mp} ca{mp}', 'Final Blend (nd)': 'ha{nd} ba{nd}',
    'Final Blend (lk)': 'mi{lk}', 'Final Blend (nk)': 'pi{nk} i{nk} ba{nk}',
    'Digraph (sh)': '{sh}ip {sh}op {sh}ell fi{sh} di{sh} bru{sh}',
    'Digraph (ch)': '{ch}ip {ch}in {ch}air ben{ch} lun{ch} pea{ch}',
    'Digraph (th)': '{th}in {th}ick ma{th} pa{th} tee{th} wi{th}',
    'Digraph (wh)': '{wh}ip {wh}ite {wh}eel {wh}ale', 'Digraph (ng)': 'ki{ng} ri{ng} si{ng} so{ng}',
  },
  5: {
    ai: 'r{ai}n tr{ai}n t{ai}l m{ai}l', ay: 'd{ay} pl{ay} s{ay} m{ay}', ee: 'b{ee} tr{ee} s{ee}d f{ee}t',
    ea: 'm{ea}t l{ea}f s{ea} t{ea}', oa: 'b{oa}t c{oa}t r{oa}d s{oa}p',
    'ow (long o)': 'sn{ow} wind{ow} yell{ow}', 'oo (short)': 'b{oo}k c{oo}k f{oo}t w{oo}d',
    'oo (long)': 'm{oo}n sp{oo}n z{oo} f{oo}d', oi: 'c{oi}n p{oi}nt', oy: 'b{oy} t{oy} j{oy}',
    ou: 'h{ou}se m{ou}se {ou}t cl{ou}d', 'ow (diphthong)': 'c{ow} {ow}l d{ow}n cr{ow}n',
    ar: 'c{ar} st{ar} p{ar}k d{ar}k', er: 'h{er} teach{er}', ir: 'b{ir}d g{ir}l sh{ir}t',
    or: 'f{or}k c{or}n h{or}se', ur: 'n{ur}se t{ur}tle',
  },
};
export const observedBank = Object.entries(stages).flatMap(([stage, rules]) => Object.entries(rules).flatMap(([rule, patterns]) => patterns.split(' ').map(pattern_marked => {
  const word = pattern_marked.replace(/[{}]/g, '');
  return { id: `observed-${stage}-${rule}-${word}`, step: Number(stage), rule, word, pattern_marked, image_url: `/phonics-images/${word}.webp`, meaning: null };
}))).map((row, sort_order) => ({ ...row, sort_order }));
