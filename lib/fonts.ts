export const fontCatalog = [
 {
  "name": "Arial",
  "family": "Arial, sans-serif",
  "group": "Modern"
 },
 {
  "name": "Georgia",
  "family": "Georgia, serif",
  "group": "Classic"
 },
 {
  "name": "Verdana",
  "family": "Verdana, sans-serif",
  "group": "Modern"
 },
 {
  "name": "Trebuchet MS",
  "family": "Trebuchet MS, sans-serif",
  "group": "Modern"
 },
 {
  "name": "Monospace",
  "family": "monospace",
  "group": "Monospace"
 },
 {
  "name": "Inter",
  "family": "\"Inter\", sans-serif",
  "group": "Modern",
  "file": "inter.woff"
 },
 {
  "name": "Roboto",
  "family": "\"Roboto\", sans-serif",
  "group": "Modern",
  "file": "roboto.woff"
 },
 {
  "name": "Montserrat",
  "family": "\"Montserrat\", sans-serif",
  "group": "Modern",
  "file": "montserrat.woff"
 },
 {
  "name": "Poppins",
  "family": "\"Poppins\", sans-serif",
  "group": "Modern",
  "file": "poppins.woff"
 },
 {
  "name": "Nunito",
  "family": "\"Nunito\", sans-serif",
  "group": "Modern",
  "file": "nunito.woff"
 },
 {
  "name": "Open Sans",
  "family": "\"Open Sans\", sans-serif",
  "group": "Modern",
  "file": "opensans.woff"
 },
 {
  "name": "Lato",
  "family": "\"Lato\", sans-serif",
  "group": "Modern",
  "file": "lato.woff"
 },
 {
  "name": "Raleway",
  "family": "\"Raleway\", sans-serif",
  "group": "Modern",
  "file": "raleway.woff"
 },
 {
  "name": "Oswald",
  "family": "\"Oswald\", sans-serif",
  "group": "Modern",
  "file": "oswald.woff"
 },
 {
  "name": "Barlow",
  "family": "\"Barlow\", sans-serif",
  "group": "Modern",
  "file": "barlow.woff"
 },
 {
  "name": "Merriweather",
  "family": "\"Merriweather\", serif",
  "group": "Classic",
  "file": "merriweather.woff"
 },
 {
  "name": "Playfair Display",
  "family": "\"Playfair Display\", serif",
  "group": "Classic",
  "file": "playfairdisplay.woff"
 },
 {
  "name": "Lora",
  "family": "\"Lora\", serif",
  "group": "Classic",
  "file": "lora.woff"
 },
 {
  "name": "Cinzel",
  "family": "\"Cinzel\", serif",
  "group": "Classic",
  "file": "cinzel.woff"
 },
 {
  "name": "Bangers",
  "family": "\"Bangers\", sans-serif",
  "group": "Bold & game show",
  "file": "bangers.woff"
 },
 {
  "name": "Bebas Neue",
  "family": "\"Bebas Neue\", sans-serif",
  "group": "Bold & game show",
  "file": "bebasneue.woff"
 },
 {
  "name": "Anton",
  "family": "\"Anton\", sans-serif",
  "group": "Bold & game show",
  "file": "anton.woff"
 },
 {
  "name": "Orbitron",
  "family": "\"Orbitron\", sans-serif",
  "group": "Bold & game show",
  "file": "orbitron.woff"
 },
 {
  "name": "Press Start 2P",
  "family": "\"Press Start 2P\", sans-serif",
  "group": "Bold & game show",
  "file": "pressstart2p.woff"
 },
 {
  "name": "Pacifico",
  "family": "\"Pacifico\", cursive",
  "group": "Handwritten",
  "file": "pacifico.woff"
 },
 {
  "name": "Dancing Script",
  "family": "\"Dancing Script\", cursive",
  "group": "Handwritten",
  "file": "dancingscript.woff"
 },
 {
  "name": "Caveat",
  "family": "\"Caveat\", cursive",
  "group": "Handwritten",
  "file": "caveat.woff"
 },
 {
  "name": "Lobster",
  "family": "\"Lobster\", cursive",
  "group": "Handwritten",
  "file": "lobster.woff"
 },
 {
  "name": "Space Mono",
  "family": "\"Space Mono\", monospace",
  "group": "Monospace",
  "file": "spacemono.woff"
 },
 {
  "name": "Roboto Mono",
  "family": "\"Roboto Mono\", monospace",
  "group": "Monospace",
  "file": "robotomono.woff"
 }
] as const;
export const fontFamilies:readonly string[]=fontCatalog.map(font=>font.family);
export const fontGroups=['Modern','Classic','Bold & game show','Handwritten','Monospace'] as const;
const base=(value:unknown)=>String(value||'').split(',')[0].replace(/["']/g,'').trim().toLowerCase();
export function isSupportedFont(value:unknown){return fontCatalog.some(font=>base(font.family)===base(value));}
export function resolveFont(value:unknown){return fontCatalog.find(font=>base(font.family)===base(value))?.family||fontCatalog[0].family;}
export function requestedFont(request:string){return [...fontCatalog].sort((a,b)=>b.name.length-a.name.length).find(font=>new RegExp('\\b'+(font.name==='Trebuchet MS'?'Trebuchet(?:\\s+MS)?':font.name)+'\\b','i').test(request));}
