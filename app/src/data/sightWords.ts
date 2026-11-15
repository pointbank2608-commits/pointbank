export const SIGHT_WORDS = (
  'an at be we to the is it in are and you for by as of he she was with but can I a ' +
  'how had there their they were have from each word said when which what where will about up one them then many some ' +
  'so these would other into has more two like him see time could no make than first been its who now people my made ' +
  'over did down only way find may water long little very after called just most know red blue yellow day away look jump play on'
).split(' ');

// Target words, representative text, and a separate illustrated reading check.
const REVIEW_ROWS = [
  ['I see a', 'I see a pig.|I see a cat.', 'I see a dog.', 'dog', 'cat'],
  ['the is in', 'The cat is in the box.', 'The dog is in the box.', 'dog', 'cat'],
  ['can you it', 'Can you see it?', 'Can you see it? It is a cat.', 'cat', 'dog'],
  ['it is an', 'It is an egg.', 'It is an apple.', 'apple', 'egg'],
  ['my and on', 'My cat and I sit on the mat.', 'My dog and I sit on the mat.', 'dog', 'cat'],
  ['he she we', 'He can run. She can hop. We can play.', 'She can swim.', 'swimming', 'run'],
  ['we to at', 'We can walk to the park at ten.', 'We can walk to the zoo at ten.', 'zoo', 'park'],
  ['blue and yellow', 'I see a blue hat and a yellow bag.', 'I see blue and yellow.', 'yellow', 'red'],
  ['of red by', 'A cup of red paint is by the door.', 'A cup of red paint is by the window.', 'window', 'door'],
  ['little is very', 'The little dog is very fast.', 'The little cat is very fast.', 'cat', 'dog'],
  ['has water its', 'The dog has water in its bowl.', 'The cat has water in its bowl.', 'cat', 'dog'],
  ['look up down', 'Look up at the sun. Look down at your feet.', 'Look up at the moon.', 'moon', 'sun'],
  ['play but jump', 'We can play here, but we can’t jump on the bed.', 'We can play here, but we can’t jump on the sofa.', 'sofa', 'bed'],
  ['one two more', 'I have one apple. I want two more.', 'I have one egg. I want two more.', 'egg', 'apple'],
  ['like little long', 'I like the little dog with a long tail.', 'I like the little cat with a long tail.', 'cat', 'dog'],
  ['day time now', 'It is a sunny day. It is time to play now.', 'It is a sunny day. It is time to swim now.', 'swimming', 'run'],
  ['are as so', 'You are as tall as me. You are so tall!', 'You are as tall as a giraffe!', 'giraffe', 'rabbit'],
  ['a with for', 'I have a bag with a snack for you.', 'I have a box with a snack for you.', 'box', 'bag'],
  ['make some no', 'Can we make some carrot soup? No, we don’t have any carrots.', 'Can we make some cake? No, we don’t have any eggs.', 'cake', 'soup'],
  ['have has many', 'I have a cat. Kim has many cats.', 'I have a dog. Kim has many dogs.', 'dog', 'cat'],
  ['where their there', 'Where is their dog? It’s over there.', 'Where is their cat? It’s over there.', 'cat', 'dog'],
  ['way over away', 'Go that way. The shop is over there, not far away.', 'Go that way. The park is over there, not far away.', 'park', 'shop'],
  ['only people may', 'Only two people may sit here.', 'Only two people may sit on the bench.', 'bench', 'chair'],
  ['who was with', 'Who was with you at the park?', 'Who was with you at the zoo?', 'zoo', 'park'],
  ['how did find', 'How did you find my hat?', 'How did you find my bag?', 'bag', 'hat'],
  ['which these two', 'Which of these two hats do you like?', 'Which of these two bags do you like?', 'bag', 'hat'],
  ['what will when', 'What will you do when it rains?', 'What will you do when it snows?', 'snow', 'rain'],
  ['where you been', 'Where have you been?', 'Where have you been? I’ve been to the park.', 'park', 'zoo'],
  ['would like be', 'Would you like to be on my team?', 'Would you like to be a doctor?', 'doctor', 'pilot'],
  ['know word could', 'I don’t know this word. Could you help me?', 'I don’t know the word “frog”. Could you help me?', 'frog', 'dog'],
  ['they were them', 'They were at the park. I saw them there.', 'They were at the zoo. I saw them there.', 'zoo', 'park'],
  ['then said just', 'Then she said, “Just one more!”', 'Then he said, “Just one more apple!”', 'apple', 'banana'],
  ['called him by', 'I called Dad. I asked him to sit by me.', 'I called my dog. I asked him to sit by me.', 'dog', 'cat'],
  ['made had after', 'We made a cake with Dad. We had a slice after lunch.', 'We made a pie. We had a slice after lunch.', 'pie', 'cake'],
  ['first into after', 'First, put the toy into the box. After that, close the lid.', 'First, put the toy into the bag. After that, close it.', 'bag', 'box'],
  ['from each about', 'Pick a book from each box. Tell me what each book is about.', 'Pick a book from each bag. Tell me what it is about.', 'bag', 'box'],
  ['than most other', 'My dog is smaller than most other dogs.', 'My cat is smaller than most other cats.', 'cat', 'dog'],
] as const;

const PRACTICE_PICTURES = [
  'pig|cat', 'cat', 'dog', 'egg', 'cat', 'run|jump|play', 'park', 'hat',
  'door', 'dog', 'dog', 'sun|feet', 'bed', 'apple', 'dog', 'sun|play', 'giraffe',
  'bag', 'carrot', 'cat', 'dog', 'shop', 'chair', 'park', 'hat', 'hat', 'rain',
  'map', 'soccer', 'book', 'park', 'apple', 'dad', 'cake', 'toy', 'book', 'dog',
];

export const SIGHT_WORD_REVIEWS = REVIEW_ROWS.map(([words, sentences, check, answer, distractor], index) => ({
  id: String(index + 1).padStart(2, '0'),
  words: words.split(' '),
  sentences: sentences.split('|'),
  practicePictures: PRACTICE_PICTURES[index].split('|'),
  check,
  answer,
  choices: index % 2 ? [answer, distractor] : [distractor, answer],
}));
