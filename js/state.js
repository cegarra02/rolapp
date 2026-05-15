var _3d = null;
let chars = JSON.parse(localStorage.getItem('rp_chars') || '[]');
let profile = JSON.parse(localStorage.getItem('rp_profile') || '{}');
let editId = null;
let currentChar = null;
let history = [];
let tempBg = null;
let tempGender = null;

let cr = {img:null,mode:'circle',onConfirm:null,scale:1,minScale:1,maxScale:8,imgX:0,imgY:0,canvasW:0,canvasH:0};
let crDrag = {on:false,sx:0,sy:0,ox:0,oy:0};
let crPinch = {on:false,d0:0,s0:1,mx:0,my:0};

let missions       = JSON.parse(localStorage.getItem('rp_missions') || '[]');
let medals         = JSON.parse(localStorage.getItem('rp_medals')   || '[]');
let mStreak        = parseInt(localStorage.getItem('rp_streak')     || '0');
let totalCompleted = parseInt(localStorage.getItem('rp_total_completed') || '0');
let mLastDate      = localStorage.getItem('rp_last_date') || '';

const RARITIES = {
  common:    {label:'Común',      icon:'⚔️', medal:'🥉', pts:1},
  rare:      {label:'Rara',       icon:'🗡️', medal:'🥈', pts:2},
  epic:      {label:'Épica',      icon:'💎', medal:'🥇', pts:3},
  legendary: {label:'Legendaria', icon:'🔥', medal:'🏆', pts:5}
};

let scenes = JSON.parse(localStorage.getItem('rp_scenes') || '[]');
let editSceneId = null;
let pickedCharIds = [];
let currentScene = null;

let swipeStartX = 0, swipeStartY = 0, isSwiped = false;

let activeMissionTab = 'active';
let missionGenTarget = null; // null = todos | {type:'char'|'scene', id, name}
