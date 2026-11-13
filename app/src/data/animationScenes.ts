import type { SceneTeaching } from '../lib/animationScene';

// The dictionary picture for "back" is deliberately absent: this scene uses the adverb.
const washingPictures = {'washing|빨래':'/word-bank-images/laundry.webp','wind|바람':'/word-bank-images/wind.webp'};
const washingActivities: NonNullable<SceneTeaching["print"]> = {
  scene:[{prompt:'What is Mum doing at the beginning of the scene?',answer:'A. Hanging out the washing.',pictures:['/word-bank-images/laundry.webp','/word-bank-images/wind.webp']}],
  trueFalse:[{prompt:'The wind blows the washing off the line.',answer:'True.'},{prompt:'Mum says it is wrong to be small.',answer:'False.'}],
  eventOrder:[{prompt:'___ Mum tells Pom Pom it is okay to be small.\n___ Mum hangs out the washing.\n___ The wind blows the washing away.',answer:'3, 1, 2.'}],
  infer:[{prompt:'How do you think Pom Pom feels when she says she cannot play? Use something she says or does.',answer:'She may feel discouraged because she says she cannot do it.'}],
  wordContext:[{prompt:'The (wind / washing) blew the clothes off the line.',answer:'wind'}],
};

export const animationScenes: Record<string,SceneTeaching> = {
  'c09c4db9-ba29-4543-bf65-a7b8abc93b72': {
    expression: {
      text:'Can you help me …?',
      explanation:'Use Can you help me + a verb to ask someone for help.',
      examples:[
        {situation:'You are carrying a heavy box.',answer:'Can you help me carry this box?'},
        {situation:'The door is hard to open.',answer:'Can you help me open the door?'},
        {situation:'You cannot find your pencil.',answer:'Can you help me find my pencil?'},
        {situation:'You need to move a chair.',answer:'Can you help me move this chair?'},
        {situation:'You cannot reach a book.',answer:'Can you help me get that book?'},
      ],
    },
    choices:{
      'What game do Bluey and Bingo want to play?':['They want to play tag.','They want to play hide-and-seek.'],
      "Who is sitting on the seesaw and won't get off?":['Bingo is sitting on it.','Bluey is sitting on it.'],
      "Why can't Bluey and Bingo get Dad off the seesaw by themselves?":['The seesaw is broken.','They cannot find the seesaw.'],
    },
    definitions:{play:'to do something for fun',off:'away from a surface or place',help:'to make something easier for someone',grab:'to take hold of something quickly',idea:'a thought about what to do'},
  },
  'f27bf371-9c13-4975-9869-6d8c233b1980': {
    wordPictures:washingPictures,
    print:washingActivities,
    expression:{
      text:"There’s nothing wrong with + -ing.",
      original:"There's nothing wrong with being small, honey.",
      explanation:'Use this pattern to tell someone that what they do or feel is okay.',
      examples:[
        {situation:'A friend feels shy on the first day.',answer:'There’s nothing wrong with feeling shy.'},
        {situation:'Your friend walks slowly.',answer:'There’s nothing wrong with walking slowly.'},
        {situation:'A friend needs help.',answer:'There’s nothing wrong with asking for help.'},
        {situation:'A classmate likes a different game.',answer:'There’s nothing wrong with liking a different game.'},
        {situation:'Your partner makes a mistake.',answer:'There’s nothing wrong with making a mistake.'},
      ],
    },
    choices:{
      'What is Mum doing at the beginning of the scene?':['She is reading a book.','She is washing the dishes.'],
      "Why does Pom Pom say she can't play washing?":['She says she is too tired.','She says she has to go home.'],
      'What does Mum say about being small?':['Mum says you have to be big to play.','Mum says small children should wait outside.'],
    },
    definitions:{know:'to have something in your mind',washing:'clothes that have been washed',wind:'air that moves',back:'to the place something was before',long:'going a great distance',small:'little in size',best:'better than all the others',poor:'feeling sorry for someone in trouble',wrong:'not right or not okay'},
  },
  '449a762b-4c92-4bb0-a911-6165d9f95de1': {
    range:{start:.1,end:69.5},
    choices:{
      'What were Caillou and his friends doing in the garden?':['They were watering the plants.','They were having a picnic.'],
      "Where did Leo's ball go?":['It went under a bench.','It went over the fence.'],
      'Who do Caillou and his friends ask for help with the code?':['They ask Leo.','They ask Clementine.'],
    },
    definitions:{play:'to do something for fun',throw:'to send something through the air with your hand',high:'far above the ground',touch:'to come against something',cloud:'a white or grey shape in the sky'},
  },
};
