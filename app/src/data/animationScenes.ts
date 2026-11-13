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
  '26cb84c1-88d2-464d-bfb6-1e2919fd787b': {
    range:{start:34.7,end:153.6},
    questionEvidence:{
      "What did Madame Gazelle forget?":{time:60.2,end:62.8},
      "What do the children make for Madame Gazelle?":{time:135.4,end:141.8},
    },
    choices:{
      "What happened to Pedro's yogurt?":['It fell on the floor.','He left it at home.'],
      'What did Madame Gazelle forget?':['She forgot her book.','She forgot her water bottle.'],
      'What do the children make for Madame Gazelle?':['They make a birthday cake.','They make a bowl of soup.'],
    },
    expression:{
      text:"Why don't we + base verb?",
      original:"Why don't we take a small bit of our lunches and make one big lunch for Madame Gazelle?",
      explanation:'Use “Why don’t we …?” to suggest something you can do together.',
      examples:[
        {situation:'Your friends have bread and cheese. Suggest making sandwiches together.',answer:"Why don't we make sandwiches?"},
        {situation:'Your friend has no snack. Suggest sharing your apples.',answer:"Why don't we share our apples?"},
        {situation:'It is raining. Suggest reading a book together.',answer:"Why don't we read a book?"},
        {situation:'Your classroom floor is messy. Suggest cleaning it together.',answer:"Why don't we clean the floor?"},
        {situation:'Your class has a ball and some free time. Suggest something to do together.',answer:"Why don't we play a game?"},
      ],
    },
    scrambleSentences:[
      'Today, Peppa and her friends are eating lunch at playgroup.',
      'What are you having for lunch, Madame Gazelle?',
      "Madame Gazelle can't miss lunch.",
      'She can have one of my sandwiches.',
      "There's only one tiny bite left.",
      'She likes crunchy things.',
    ],
  },
  'c09c4db9-ba29-4543-bf65-a7b8abc93b72': {
    scrambleSentences:["I've got an idea.", "We'll seesaw him off."],
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
    scrambleSentences:[
      'My washing is hung out.',
      "The wind's blowing my washing off the line!",
      'I have to get it back!',
      "There's nothing wrong with being small, honey.",
    ],
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
    expression:{
      text:"It's + in / on / under + place.",
      original:"It's in the tree.",
      explanation:'Use in for inside, on for touching the top, and under for below.',
      examples:[
        {situation:'Your toy is inside an open box. Where is it?',answer:"It's in the box."},
        {situation:'Your book is resting on top of the table. Where is it?',answer:"It's on the table."},
        {situation:'A ball rolled beneath your chair. Where is it?',answer:"It's under the chair."},
        {situation:'Your hat is inside your bag. Where is it?',answer:"It's in the bag."},
        {situation:'Your cat is hiding beneath the bed. Where is it?',answer:"It's under the bed."},
      ],
    },
    scrambleSentences:[
      'Caillou, Leo and Clementine were having lots of fun playing in the garden.',
      'They were having a competition to see who could throw the ball the highest.',
      'It almost touched the roof of the house.',
      'Mine is gonna touch the clouds.',
      "It's in the tree.",
    ],
    choices:{
      'What were Caillou and his friends doing in the garden?':['They were watering the plants.','They were having a picnic.'],
      "Where did Leo's ball go?":['It went under a bench.','It went over the fence.'],
      'Who do Caillou and his friends ask for help with the code?':['They ask Leo.','They ask Clementine.'],
    },
    definitions:{play:'to do something for fun',throw:'to send something through the air with your hand',high:'far above the ground',touch:'to come against something',cloud:'a white or grey shape in the sky'},
  },
};
