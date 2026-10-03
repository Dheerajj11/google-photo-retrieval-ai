const u = (id, w=1100) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=82`

export const demoPhotos = [
  { id:'cafe-01', url:u('photo-1501339847302-ac426a4a7cbb'), title:'Café table with plants', taken:'2025-06-18', place:'Goa', cluster:'cafe', tags:['cafe','plants','friends','outdoor','day','trip'], description:'Outdoor café table surrounded by greenery during a trip.' },
  { id:'cafe-02', url:u('photo-1517248135467-4c7edcad34c4'), title:'Warm restaurant interior', taken:'2025-06-18', place:'Goa', cluster:'cafe', tags:['cafe','restaurant','indoor','evening','warm lights','trip'], description:'Warmly lit indoor restaurant with tables and hanging lights.' },
  { id:'cafe-03', url:u('photo-1495474472287-4d71bcdd2085'), title:'Coffee by the window', taken:'2025-06-19', place:'Goa', cluster:'cafe', tags:['coffee','cafe','window','day','table'], description:'Coffee on a table near a bright café window.' },
  { id:'cafe-04', url:u('photo-1445116572660-236099ec97a0'), title:'Café counter', taken:'2025-06-19', place:'Goa', cluster:'cafe', tags:['cafe','counter','indoor','people','day'], description:'Busy café counter with people in the background.' },
  { id:'cafe-05', url:u('photo-1501339847302-ac426a4a7cbb', 900), title:'Similar café shot', taken:'2025-06-18', place:'Goa', cluster:'cafe', tags:['cafe','plants','friends','outdoor','day','trip','similar'], description:'Near-duplicate view from the same café moment.', duplicateOf:'cafe-01' },

  { id:'city-01', url:u('photo-1477959858617-67f85cf4f1df'), title:'City skyline', taken:'2025-02-12', place:'Bengaluru', cluster:'city', tags:['city','skyline','buildings','day','urban'], description:'Wide daytime city skyline with dense buildings.' },
  { id:'city-02', url:u('photo-1519608487953-e999c86e7455'), title:'City lights at night', taken:'2025-02-13', place:'Bengaluru', cluster:'city', tags:['city','night','lights','buildings','urban'], description:'Urban night scene with bright city lights.' },
  { id:'city-03', url:u('photo-1480714378408-67cf0d13bc1b'), title:'Street between tall buildings', taken:'2025-02-13', place:'Bengaluru', cluster:'city', tags:['city','street','buildings','day','urban'], description:'Street-level view between tall urban buildings.' },
  { id:'city-04', url:u('photo-1444723121867-7a241cacace9'), title:'Night traffic', taken:'2025-02-13', place:'Bengaluru', cluster:'city', tags:['city','night','traffic','lights','road'], description:'Night traffic and glowing city lights.' },

  { id:'land-01', url:u('photo-1501785888041-af3ef285b470'), title:'Mountain valley', taken:'2024-12-29', place:'Western Ghats', cluster:'landscape', tags:['mountain','landscape','valley','green','trip','day'], description:'Green mountain valley under open sky.' },
  { id:'land-02', url:u('photo-1507525428034-b723cf961d3e'), title:'Beach and blue water', taken:'2025-06-17', place:'Goa', cluster:'landscape', tags:['beach','sea','blue water','sand','trip','day'], description:'Bright beach with blue water and pale sand.' },
  { id:'land-03', url:u('photo-1473448912268-2022ce9509d8'), title:'Forest trail', taken:'2024-12-30', place:'Western Ghats', cluster:'landscape', tags:['forest','trees','trail','green','trip','day'], description:'Green forest path surrounded by trees.' },
  { id:'land-04', url:u('photo-1464822759023-fed622ff2c3b'), title:'Mountain peak', taken:'2024-12-30', place:'Western Ghats', cluster:'landscape', tags:['mountain','peak','landscape','clouds','trip'], description:'Rocky mountain peak rising into clouds.' },

  { id:'people-01', url:u('photo-1529156069898-49953e39b3ac'), title:'Friends outdoors', taken:'2024-08-11', place:'Bengaluru', cluster:'people', tags:['friends','people','group','outdoor','smiling','moment'], description:'Group of friends together outdoors.' },
  { id:'people-02', url:u('photo-1511632765486-a01980e01a18'), title:'Friends sitting together', taken:'2024-08-11', place:'Bengaluru', cluster:'people', tags:['friends','people','group','sitting','moment'], description:'Friends sitting closely together in a casual moment.' },
  { id:'people-03', url:u('photo-1529333166437-7750a6dd5a70'), title:'Family moment', taken:'2024-11-03', place:'Bengaluru', cluster:'people', tags:['family','people','indoor','moment','celebration'], description:'Warm family moment indoors.' },
  { id:'people-04', url:u('photo-1529156069898-49953e39b3ac', 900), title:'Similar group photo', taken:'2024-08-11', place:'Bengaluru', cluster:'people', tags:['friends','people','group','outdoor','similar','moment'], description:'Near-duplicate group photo from the same moment.', duplicateOf:'people-01' },

  { id:'med-01', url:u('photo-1584308666744-24d5c474f2ae'), title:'Medicine bottle and tablets', taken:'2025-01-08', place:'Home', cluster:'medicine', tags:['medicine','tablets','bottle','health','product','table'], description:'Medicine bottle and tablets photographed on a table.' },
  { id:'med-02', url:u('photo-1471864190281-a93a3070b6de'), title:'Tablets close-up', taken:'2025-01-08', place:'Home', cluster:'medicine', tags:['medicine','pills','tablets','closeup','product'], description:'Close-up photograph of tablets and capsules.' },
  { id:'med-03', url:u('photo-1576091160399-112ba8d25d1d'), title:'Healthcare item', taken:'2025-01-09', place:'Clinic', cluster:'medicine', tags:['medicine','healthcare','clinic','product','white'], description:'Healthcare product photographed in a clinical setting.' },

  { id:'doc-01', url:u('photo-1456324504439-367cee3b3c32'), title:'Document beside laptop', taken:'2025-03-02', place:'Home', cluster:'document', tags:['document','paper','laptop','desk','work'], description:'Paper document placed beside a laptop on a desk.' },
  { id:'doc-02', url:u('photo-1434030216411-0b793f4b4173'), title:'Notes and laptop', taken:'2025-03-02', place:'Home', cluster:'document', tags:['notes','document','laptop','desk','study'], description:'Notebook and laptop arranged on a study desk.' },
  { id:'moment-01', url:u('photo-1492684223066-81342ee5ff30'), title:'Celebration lights', taken:'2024-10-31', place:'Bengaluru', cluster:'event', tags:['event','celebration','lights','night','people','moment'], description:'Celebration scene with people and bright lights at night.' },
  { id:'moment-02', url:u('photo-1505236858219-8359eb29e329'), title:'Concert crowd', taken:'2024-10-31', place:'Bengaluru', cluster:'event', tags:['event','crowd','night','lights','people','moment'], description:'Crowd enjoying a night event with colorful lighting.' }
]

export const demoTasks = [
  'Find the café photo from the Goa trip with plants around the table.',
  'Find the medicine photo with tablets on a table.',
  'Find the city photo taken at night with bright lights.',
  'Find the group photo from an outdoor moment with friends.',
  'Find the beach photo from the trip.'
]
