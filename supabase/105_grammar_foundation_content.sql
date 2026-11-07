-- Four versioned grammar homework units using the existing student flow.
begin;

do $$
declare
  lesson jsonb;
  existing jsonb;
begin
  for lesson in select value from jsonb_array_elements($grammar_foundations$
[
  {
    "goalId": "present-s-vs-does",
    "grammarIds": [
      "third-s",
      "does-he"
    ],
    "version": 1,
    "title": "Mina plays, Does Mina play? · 현재형에서 -s의 자리",
    "objective": "한 사람의 습관을 말할 때와 그 습관을 물을 때 일반동사의 형태를 고른다.",
    "rule": "현재의 습관을 말하는 문장에서 주어가 he, she, it 또는 그 자리에 넣을 수 있는 한 사람이나 사물이면 plays처럼 동사 모양이 달라져요. 같은 습관을 질문하면 Does가 앞으로 와요. Does가 현재와 주어에 맞는 형태를 이미 보여 주므로, 뒤의 행동 동사는 play라는 기본형을 써요.",
    "boundary": "I, you, we, they의 습관을 물을 때는 Do로 시작해요. is나 are가 있는 문장과 can이 있는 문장은 각각 그 말을 앞으로 보내요. 여기서는 일반동사로 습관을 묻는 문장에 집중해요.",
    "examples": [
      {
        "sentence": "Mina plays tennis on Fridays.",
        "translation": "미나는 금요일마다 테니스를 쳐요.",
        "why": "Mina를 she로 바꿀 수 있고, 평소 하는 일을 말하는 문장이어서 plays가 돼요.",
        "chunks": [
          {
            "text": "Mina",
            "term": "주어",
            "role": "누가 하는지"
          },
          {
            "text": "plays",
            "term": "일반동사",
            "role": "평소 하는 행동"
          },
          {
            "text": "tennis",
            "term": "목적어",
            "role": "무슨 운동인지"
          },
          {
            "text": "on Fridays",
            "term": "시간 표현",
            "role": "언제 반복하는지"
          }
        ]
      },
      {
        "sentence": "Does Mina play tennis on Fridays?",
        "translation": "미나는 금요일마다 테니스를 치나요?",
        "why": "한 사람의 습관을 묻는다고 Does가 표시해요. 행동 이름은 play 그대로 둬요.",
        "chunks": [
          {
            "text": "Does",
            "term": "조동사",
            "role": "한 사람의 습관을 묻는 표시"
          },
          {
            "text": "Mina",
            "term": "주어",
            "role": "누구에게 해당하는지"
          },
          {
            "text": "play",
            "term": "동사원형",
            "role": "무슨 행동인지"
          },
          {
            "text": "tennis",
            "term": "목적어",
            "role": "무슨 운동인지"
          },
          {
            "text": "on Fridays",
            "term": "시간 표현",
            "role": "언제 하는지"
          }
        ]
      }
    ],
    "reasoning": {
      "id": "present-s-reason",
      "sentence": "Does your sister ___ comics after school?",
      "prompt": "문장을 완성하는 말과 그 이유를 함께 고르세요.",
      "correctOptionId": "read",
      "options": [
        {
          "id": "reads",
          "text": "reads · your sister가 한 명이니까요.",
          "feedback": "말하는 문장 Your sister reads …에서는 그 이유가 맞아요. 질문에서는 Does가 그 역할을 맡으므로 read를 써요."
        },
        {
          "id": "read",
          "text": "read · Does가 한 사람의 습관을 묻고 있어요.",
          "feedback": "맞아요. Does를 먼저 확인하면 뒤의 행동 동사는 read 그대로 쓸 수 있어요."
        },
        {
          "id": "reading",
          "text": "reading · 방과 후에 하는 행동이니까요.",
          "feedback": "after school은 습관이 일어나는 때를 알려 줘요. Does로 묻는 습관에는 read를 써요."
        }
      ]
    },
    "repair": {
      "explanation": "먼저 한 사람의 습관을 말하는지, 묻는지 골라 보세요. 말하면 cooks, 묻기 위해 Does를 쓰면 cook이에요. -s가 필요한 자리를 문장 전체에서 확인해 보세요.",
      "example": {
        "sentence": "Does Ben cook dinner on Sundays?",
        "translation": "벤은 일요일마다 저녁을 요리하나요?",
        "why": "Ben은 he예요. Does가 이미 있으므로 cook에 -s를 붙이지 않아요.",
        "chunks": [
          {
            "text": "Does",
            "term": "조동사",
            "role": "한 사람의 습관 질문"
          },
          {
            "text": "Ben",
            "term": "주어",
            "role": "요리하는 사람"
          },
          {
            "text": "cook",
            "term": "동사원형",
            "role": "하는 행동"
          },
          {
            "text": "dinner",
            "term": "목적어",
            "role": "만드는 음식"
          },
          {
            "text": "on Sundays",
            "term": "시간 표현",
            "role": "반복되는 날"
          }
        ]
      },
      "practice": {
        "id": "present-s-practice",
        "sentence": "Leo ___ to school every day.",
        "prompt": "문장을 완성하는 말과 그 이유를 함께 고르세요.",
        "correctOptionId": "walks",
        "options": [
          {
            "id": "walks",
            "text": "walks · Leo 한 사람의 습관을 말해요.",
            "feedback": "맞아요. Does로 시작하는 질문이 아니므로 walks라고 써요."
          },
          {
            "id": "walk",
            "text": "walk · every day가 현재의 습관을 알려 줘요.",
            "feedback": "습관이라는 해석은 맞아요. 문장이 질문인지도 보세요. Leo 한 사람의 습관을 말하므로 walks예요."
          },
          {
            "id": "walking",
            "text": "walking · 걷는 행동을 설명하고 있어요.",
            "feedback": "현재의 습관을 말하는 문장의 중심 동사가 필요해요. Leo의 습관이라서 walks예요."
          }
        ]
      }
    },
    "transfer": {
      "id": "present-s-transfer",
      "sentence": "___ your parents drink tea in the morning?",
      "prompt": "문장을 완성하는 말과 그 이유를 함께 고르세요.",
      "correctOptionId": "do-plural",
      "options": [
        {
          "id": "does",
          "text": "Does · 부모님이라는 사람을 묻는 문장이에요.",
          "feedback": "사람인지보다 한 명인지 여러 명인지 보세요. your parents는 they이므로 Do를 써요."
        },
        {
          "id": "do-time",
          "text": "Do · in the morning이 들어 있기 때문이에요.",
          "feedback": "Do는 맞지만 아침이라서 고르는 말은 아니에요. your parents를 they로 바꿀 수 있어서 Do예요."
        },
        {
          "id": "do-plural",
          "text": "Do · your parents를 they로 바꿀 수 있어요.",
          "feedback": "맞아요. they의 습관 질문은 Do로 시작하고, drink는 기본형으로 써요."
        }
      ]
    },
    "delayed": {
      "id": "present-s-delay",
      "sentence": "Does Emma ___ her bike on Saturdays?",
      "prompt": "문장을 완성하는 말과 그 이유를 함께 고르세요.",
      "correctOptionId": "ride",
      "options": [
        {
          "id": "ride",
          "text": "ride · Does가 이미 Emma의 습관을 묻고 있어요.",
          "feedback": "맞아요. 말할 때는 Emma rides …, 물을 때는 Does Emma ride …예요."
        },
        {
          "id": "rides",
          "text": "rides · Emma를 she로 바꿀 수 있으니까요.",
          "feedback": "Emma가 she라는 점은 맞아요. 여기서는 Does가 앞에 있으므로 rides 대신 ride를 써요."
        },
        {
          "id": "riding",
          "text": "riding · 자전거를 타는 행동이니까요.",
          "feedback": "행동 이름이 필요하지만 Does 뒤에서는 -ing형 대신 기본형 ride를 써요."
        }
      ]
    }
  },
  {
    "goalId": "can-base-verb",
    "grammarIds": [
      "i-can"
    ],
    "version": 1,
    "title": "She can swim · can 뒤의 동사",
    "objective": "능력을 나타내는 can 또는 cannot 뒤에 행동 동사의 원형을 쓴다.",
    "rule": "can은 ‘할 수 있다’는 뜻을 행동에 더해요. 어떤 행동인지 바로 이어 말하기 때문에 can 뒤에는 swim 같은 동사의 기본형을 써요. She swims처럼 혼자 쓰일 때와 달리, She can swim에서는 주어가 she여도 swim에 -s를 붙이지 않아요.",
    "boundary": "want to swim에서는 want 뒤에 to가 들어가지만 can swim에서는 can 뒤에 동사를 바로 써요. can이 허락을 뜻할 때도 모양은 같아요. 이번에는 무엇을 할 수 있는지 말하는 경우를 연습해요.",
    "examples": [
      {
        "sentence": "Nora sings well.",
        "translation": "노라는 노래를 잘해요.",
        "why": "Nora가 평소에 하는 일을 말해요. 주어가 한 사람이므로 sings를 써요.",
        "chunks": [
          {
            "text": "Nora",
            "term": "주어",
            "role": "누가 하는지"
          },
          {
            "text": "sings",
            "term": "일반동사",
            "role": "평소 하는 행동"
          },
          {
            "text": "well",
            "term": "부사",
            "role": "얼마나 잘하는지"
          }
        ]
      },
      {
        "sentence": "Nora can sing well.",
        "translation": "노라는 노래를 잘할 수 있어요.",
        "why": "can이 능력을 더해 주고, sing은 무슨 행동을 할 수 있는지 알려 줘요.",
        "chunks": [
          {
            "text": "Nora",
            "term": "주어",
            "role": "누가 할 수 있는지"
          },
          {
            "text": "can",
            "term": "조동사",
            "role": "할 수 있다는 뜻"
          },
          {
            "text": "sing",
            "term": "동사원형",
            "role": "할 수 있는 행동"
          },
          {
            "text": "well",
            "term": "부사",
            "role": "얼마나 잘하는지"
          }
        ]
      }
    ],
    "reasoning": {
      "id": "can-base-reason",
      "sentence": "Sam can ___ a kite.",
      "prompt": "문장을 완성하는 말과 그 이유를 함께 고르세요.",
      "correctOptionId": "fly",
      "options": [
        {
          "id": "flies",
          "text": "flies · Sam이 한 명이니까요.",
          "feedback": "Sam flies …에서는 맞아요. 여기에는 can이 있어서 뒤에 fly를 써요."
        },
        {
          "id": "to-fly",
          "text": "to fly · can이 ‘~하는 것’을 말하니까요.",
          "feedback": "want to fly에는 to가 들어가요. can은 뒤에 fly를 바로 이어서 써요."
        },
        {
          "id": "fly",
          "text": "fly · can 바로 뒤에는 행동 동사의 기본형을 써요.",
          "feedback": "맞아요. can이 능력을 더하고 fly가 행동을 말해요."
        }
      ]
    },
    "repair": {
      "explanation": "먼저 ‘할 수 있다’를 맡은 can을 찾으세요. 그다음 ‘무엇을?’에 답하는 행동을 기본형으로 붙여요. 할 수 없다고 말하는 cannot 뒤에도 같은 모양을 써요.",
      "example": {
        "sentence": "I cannot open this box.",
        "translation": "나는 이 상자를 열 수 없어요.",
        "why": "cannot이 할 수 없다고 말해요. 어떤 행동인지 알려 주는 open은 기본형이에요.",
        "chunks": [
          {
            "text": "I",
            "term": "주어",
            "role": "누가 열 수 없는지"
          },
          {
            "text": "cannot",
            "term": "조동사 부정형",
            "role": "할 수 없다는 뜻"
          },
          {
            "text": "open",
            "term": "동사원형",
            "role": "하려는 행동"
          },
          {
            "text": "this box",
            "term": "목적어",
            "role": "무엇을 여는지"
          }
        ]
      },
      "practice": {
        "id": "can-base-practice",
        "sentence": "The baby cannot ___ yet.",
        "prompt": "문장을 완성하는 말과 그 이유를 함께 고르세요.",
        "correctOptionId": "walk",
        "options": [
          {
            "id": "walk",
            "text": "walk · cannot 뒤에도 동사의 기본형을 써요.",
            "feedback": "맞아요. not은 할 수 있다는 뜻을 부정해요. walk의 모양은 그대로예요."
          },
          {
            "id": "walks",
            "text": "walks · the baby가 한 명이니까요.",
            "feedback": "한 명인 것은 맞지만 cannot이 있어요. 이때 행동 이름은 walk예요."
          },
          {
            "id": "to-walk",
            "text": "to walk · 할 수 없는 행동을 설명하니까요.",
            "feedback": "할 수 없는 행동을 설명하는 것은 맞아요. cannot은 행동 앞에 to를 넣지 않아요."
          }
        ]
      }
    },
    "transfer": {
      "id": "can-base-transfer",
      "sentence": "Can your brother ___ a bike?",
      "prompt": "문장을 완성하는 말과 그 이유를 함께 고르세요.",
      "correctOptionId": "ride",
      "options": [
        {
          "id": "to-ride",
          "text": "to ride · 자전거를 탈 수 있는지 묻는 말이에요.",
          "feedback": "뜻은 맞아요. can을 질문 앞에 옮겨도 ride 앞에 to를 붙이지 않아요."
        },
        {
          "id": "ride",
          "text": "ride · Can으로 시작하는 질문에도 기본형을 써요.",
          "feedback": "맞아요. 질문에서는 Can이 앞으로 가고 행동 동사의 모양은 ride 그대로예요."
        },
        {
          "id": "rides",
          "text": "rides · your brother가 한 명이니까요.",
          "feedback": "your brother는 한 명이에요. 그래도 Can이 있는 질문에서는 ride를 써요."
        }
      ]
    },
    "delayed": {
      "id": "can-base-delay",
      "sentence": "My aunt can ___ three languages.",
      "prompt": "문장을 완성하는 말과 그 이유를 함께 고르세요.",
      "correctOptionId": "speak",
      "options": [
        {
          "id": "speaks",
          "text": "speaks · My aunt를 she로 바꿀 수 있어요.",
          "feedback": "주어를 she로 바꿀 수 있어요. 그렇더라도 can 뒤에는 speak가 와요."
        },
        {
          "id": "speak",
          "text": "speak · can 다음에 행동 이름을 기본형으로 붙여요.",
          "feedback": "맞아요. My aunt speaks …에 can을 넣어 능력을 말하면 My aunt can speak …가 돼요."
        },
        {
          "id": "to-speak",
          "text": "to speak · 세 언어를 말하는 능력을 말해요.",
          "feedback": "능력이라는 해석은 맞아요. 영어는 can과 speak 사이에 to 없이 이어 써요."
        }
      ]
    }
  },
  {
    "goalId": "comparative-er-than",
    "grammarIds": [
      "comparative"
    ],
    "version": 1,
    "title": "tall과 taller · 두 대상을 비교하는 말",
    "objective": "tall, short, old, young처럼 이 단원에서 다루는 짧은 형용사로 두 대상을 비교한다.",
    "rule": "This tree is tall.은 나무 한 그루의 특징을 말해요. This tree is taller than that tree.에서는 두 나무를 견줘요. taller의 -er가 ‘더’를 나타내고, than 뒤에 비교 기준을 놓아요. 그래서 무엇이 더 큰지와 무엇을 기준으로 삼는지가 함께 보여요.",
    "boundary": "모든 형용사에 -er를 붙이지는 않아요. expensive는 more expensive, good은 better가 돼요. 비교 대상이 앞에서 이미 나왔다면 This tree is taller.처럼 than 뒤를 생략할 수도 있어요.",
    "examples": [
      {
        "sentence": "This tree is tall.",
        "translation": "이 나무는 키가 커요.",
        "why": "다른 나무와 견주지 않고 이 나무의 특징을 말해요.",
        "chunks": [
          {
            "text": "This tree",
            "term": "주어",
            "role": "특징을 말할 대상"
          },
          {
            "text": "is",
            "term": "be동사",
            "role": "대상과 특징을 이어 줌"
          },
          {
            "text": "tall",
            "term": "형용사",
            "role": "키가 크다는 특징"
          }
        ]
      },
      {
        "sentence": "This tree is taller than that tree.",
        "translation": "이 나무는 저 나무보다 키가 커요.",
        "why": "-er가 ‘더’를, than that tree가 무엇과 비교하는지를 알려 줘요.",
        "chunks": [
          {
            "text": "This tree",
            "term": "주어",
            "role": "기준과 견줄 대상"
          },
          {
            "text": "is",
            "term": "be동사",
            "role": "대상과 특징을 이어 줌"
          },
          {
            "text": "taller",
            "term": "비교급",
            "role": "키가 더 큼"
          },
          {
            "text": "than that tree",
            "term": "비교 표현",
            "role": "저 나무를 기준으로"
          }
        ]
      }
    ],
    "reasoning": {
      "id": "er-than-reason",
      "sentence": "This rope is ___ than that rope.",
      "prompt": "문장을 완성하는 말과 그 이유를 함께 고르세요.",
      "correctOptionId": "shorter",
      "options": [
        {
          "id": "short",
          "text": "short · 이 줄이 짧다는 특징을 말해요.",
          "feedback": "짧다는 방향은 맞아요. 저 줄과 견주므로 ‘더 짧다’는 shorter가 필요해요."
        },
        {
          "id": "shorter",
          "text": "shorter · 저 줄을 기준으로 더 짧다고 말해요.",
          "feedback": "맞아요. shorter가 더 짧다는 뜻이고 than 뒤에 비교 기준이 와요."
        },
        {
          "id": "more-shorter",
          "text": "more shorter · 비교니까 두 곳에 ‘더’를 써요.",
          "feedback": "shorter 안의 -er가 이미 ‘더’를 뜻해요. more를 함께 쓰지 않아요."
        }
      ]
    },
    "repair": {
      "explanation": "비교에서 ‘무엇보다?’에 해당하는 말을 먼저 찾아 보세요. 그 기준에 비해 ‘더 어떻다’는 뜻을 old → older처럼 앞에 표시해요.",
      "example": {
        "sentence": "My bike is older than yours.",
        "translation": "내 자전거는 네 것보다 오래됐어요.",
        "why": "내 자전거를 네 자전거와 비교해요. older가 ‘더 오래된’을, than yours가 기준을 말해요.",
        "chunks": [
          {
            "text": "My bike",
            "term": "주어",
            "role": "나이를 견줄 대상"
          },
          {
            "text": "is",
            "term": "be동사",
            "role": "대상과 특징을 이어 줌"
          },
          {
            "text": "older",
            "term": "비교급",
            "role": "더 오래됨"
          },
          {
            "text": "than yours",
            "term": "비교 표현",
            "role": "네 자전거를 기준으로"
          }
        ]
      },
      "practice": {
        "id": "er-than-practice",
        "sentence": "Leo is ___ than his brother.",
        "prompt": "문장을 완성하는 말과 그 이유를 함께 고르세요.",
        "correctOptionId": "younger",
        "options": [
          {
            "id": "younger",
            "text": "younger · 형이나 동생보다 더 어리다고 말해요.",
            "feedback": "맞아요. younger는 더 어리다는 뜻이에요. 비교 기준은 his brother예요."
          },
          {
            "id": "young",
            "text": "young · Leo가 어리다는 특징을 말해요.",
            "feedback": "문장에 than his brother가 있어요. Leo의 특징을 다른 사람과 견주므로 younger를 써요."
          },
          {
            "id": "youngest",
            "text": "youngest · 두 사람을 견주므로 ‘가장’이에요.",
            "feedback": "여기서는 다른 한 사람을 기준으로 ‘더’를 말해요. youngest는 어떤 집단에서 ‘가장 어린’을 말해요."
          }
        ]
      }
    },
    "transfer": {
      "id": "er-than-transfer",
      "sentence": "Your desk is taller than mine.",
      "prompt": "이 문장의 뜻과 그 근거를 함께 고르세요.",
      "correctOptionId": "your-desk",
      "options": [
        {
          "id": "mine",
          "text": "내 책상이 더 높아요 · mine이 than 뒤에 있어요.",
          "feedback": "mine은 비교 기준이에요. 더 높다고 말하는 대상은 문장 앞의 Your desk예요."
        },
        {
          "id": "height",
          "text": "네 책상이 높아요 · taller는 높이를 나타내요.",
          "feedback": "높이를 말하는 것은 맞아요. 여기서는 단순히 높다는 뜻에 ‘내 책상보다 더’가 들어가요."
        },
        {
          "id": "your-desk",
          "text": "네 책상이 내 책상보다 높아요 · mine은 비교 기준이에요.",
          "feedback": "맞아요. 앞의 Your desk가 더 높고 than mine은 비교 기준을 알려 줘요."
        }
      ]
    },
    "delayed": {
      "id": "er-than-delay",
      "sentence": "The green pencil is ___ than the blue one.",
      "prompt": "문장을 완성하는 말과 그 이유를 함께 고르세요.",
      "correctOptionId": "shorter",
      "options": [
        {
          "id": "shorter",
          "text": "shorter · 파란 연필과 길이를 견주고 있어요.",
          "feedback": "맞아요. 초록 연필이 더 짧고, 파란 연필은 비교 기준이에요."
        },
        {
          "id": "short",
          "text": "short · 초록 연필의 길이만 말하고 있어요.",
          "feedback": "than the blue one이 파란 연필을 기준으로 삼아요. ‘더 짧다’는 shorter를 써요."
        },
        {
          "id": "more-shorter",
          "text": "more shorter · 더 짧다는 뜻을 분명히 해요.",
          "feedback": "shorter만으로 이미 ‘더 짧다’는 뜻이 분명해요. more를 더 쓰지 않아요."
        }
      ]
    }
  },
  {
    "goalId": "because-reason-clause",
    "grammarIds": [
      "because"
    ],
    "version": 1,
    "title": "because · 왜 그랬는지 설명하기",
    "objective": "because 뒤의 주어와 동사가 앞 행동의 이유를 말한다는 것을 이해하고 쓴다.",
    "rule": "먼저 어떤 일이 있었는지 찾고 ‘왜?’라고 물어보세요. 그 답을 because 뒤에 놓아요. We went inside because it rained.에서 안으로 들어간 이유는 비가 왔기 때문이에요. because 뒤의 it rained는 누가 또는 무엇이 어땠는지를 동사로 말하는 덩어리예요.",
    "boundary": "because it rained처럼 주어와 동사가 들어가는 말을 붙여요. the rain처럼 이름만 붙이면 because of the rain이라고 해요. Because it rained, we went inside.처럼 이유를 앞에 말할 수도 있어요.",
    "examples": [
      {
        "sentence": "We went inside because it rained.",
        "translation": "비가 와서 우리는 안으로 들어갔어요.",
        "why": "왜 들어갔냐고 물으면 비가 왔기 때문이라는 답이 나와요.",
        "chunks": [
          {
            "text": "We went inside",
            "term": "결과를 말하는 절",
            "role": "무슨 일이 있었는지"
          },
          {
            "text": "because",
            "term": "접속사",
            "role": "이유가 나오는 자리"
          },
          {
            "text": "it rained",
            "term": "이유를 말하는 절",
            "role": "왜 들어갔는지"
          }
        ]
      },
      {
        "sentence": "It rained, so we went inside.",
        "translation": "비가 왔어요. 그래서 우리는 안으로 들어갔어요.",
        "why": "같은 일을 말하지만 순서가 달라요. so 뒤의 내용은 비가 온 결과예요.",
        "chunks": [
          {
            "text": "It rained",
            "term": "원인을 말하는 절",
            "role": "먼저 무슨 일이 있었는지"
          },
          {
            "text": "so",
            "term": "접속사",
            "role": "결과가 나오는 자리"
          },
          {
            "text": "we went inside",
            "term": "결과를 말하는 절",
            "role": "그 때문에 무엇을 했는지"
          }
        ]
      }
    ],
    "reasoning": {
      "id": "because-reason",
      "sentence": "I turned on the light ___ the room was dark.",
      "prompt": "두 부분의 관계를 보고 알맞은 말과 이유를 고르세요.",
      "correctOptionId": "reason",
      "options": [
        {
          "id": "so",
          "text": "so · 불을 켠 결과 방이 어두워졌어요.",
          "feedback": "방이 어두워서 불을 켠 것이 자연스러워요. 뒤의 내용이 이유이므로 because를 써요."
        },
        {
          "id": "reason",
          "text": "because · 어두웠던 것이 불을 켠 이유예요.",
          "feedback": "맞아요. ‘왜 불을 켰지?’에 the room was dark가 답해요."
        },
        {
          "id": "and",
          "text": "and · 두 일을 이유 관계 없이 이어 줘요.",
          "feedback": "and도 정보를 이어 주지만, 여기서는 어둠이 불을 켠 이유라는 관계를 표시하려고 해요."
        }
      ]
    },
    "repair": {
      "explanation": "두 덩어리에 ‘일어난 일’과 ‘왜?’를 붙여 보세요. 뒤쪽이 ‘왜?’의 답이고 주어와 동사가 있으면 because를 붙여요. 뒤쪽이 ‘그래서 무슨 일이 났어?’의 답이면 so가 어울려요.",
      "example": {
        "sentence": "I wore a coat because the wind was cold.",
        "translation": "바람이 차가워서 코트를 입었어요.",
        "why": "코트를 입은 일이 먼저 나오고, 왜 입었는지는 because 뒤에 나와요.",
        "chunks": [
          {
            "text": "I wore a coat",
            "term": "결과를 말하는 절",
            "role": "한 행동"
          },
          {
            "text": "because",
            "term": "접속사",
            "role": "이유 표시"
          },
          {
            "text": "the wind was cold",
            "term": "이유를 말하는 절",
            "role": "왜 코트를 입었는지"
          }
        ]
      },
      "practice": {
        "id": "because-practice",
        "sentence": "Mia drank water ___ she was thirsty.",
        "prompt": "두 부분의 관계를 보고 알맞은 말과 이유를 고르세요.",
        "correctOptionId": "reason",
        "options": [
          {
            "id": "reason",
            "text": "because · 목이 마른 것이 물을 마신 이유예요.",
            "feedback": "맞아요. ‘왜 물을 마셨지?’에 she was thirsty가 답해요."
          },
          {
            "id": "so",
            "text": "so · 목이 마른 것은 물을 마신 결과예요.",
            "feedback": "순서를 살펴보세요. 먼저 목이 말랐고 그래서 물을 마셨어요. 여기서는 이유를 뒤에 말하므로 because예요."
          },
          {
            "id": "because-of",
            "text": "because of · 뒤에 she was thirsty가 이유로 와요.",
            "feedback": "이유라는 판단은 맞아요. she와 was가 있는 덩어리 앞에는 because를 써요. because of 뒤에는 the heat처럼 이름을 붙여요."
          }
        ]
      }
    },
    "transfer": {
      "id": "because-transfer",
      "sentence": "The bus was late, ___ we walked to school.",
      "prompt": "두 부분의 관계를 보고 알맞은 말과 이유를 고르세요.",
      "correctOptionId": "result",
      "options": [
        {
          "id": "because",
          "text": "because · 학교까지 걸어서 버스가 늦어졌어요.",
          "feedback": "걸어서 버스가 늦어진 게 아니에요. 버스가 늦어서 걸었으므로 뒤쪽은 결과예요."
        },
        {
          "id": "result",
          "text": "so · 버스가 늦어서 생긴 일이 뒤에 나와요.",
          "feedback": "맞아요. 이 문장은 원인부터 말해요. 결과를 먼저 말하려면 We walked to school because the bus was late.라고 할 수 있어요."
        },
        {
          "id": "but",
          "text": "but · 버스가 늦은 일과 걸은 일이 서로 반대예요.",
          "feedback": "두 일이 반대라기보다 앞일 때문에 뒷일이 생겼어요. 그래서 결과를 잇는 so를 써요."
        }
      ]
    },
    "delayed": {
      "id": "because-delay",
      "sentence": "I called my friend ___ I needed help.",
      "prompt": "두 부분의 관계를 보고 알맞은 말과 이유를 고르세요.",
      "correctOptionId": "reason",
      "options": [
        {
          "id": "because-of",
          "text": "because of · I needed help가 이유니까요.",
          "feedback": "이유는 잘 찾았어요. I와 needed가 함께 있는 말 앞에는 because를 써요."
        },
        {
          "id": "so",
          "text": "so · 도움이 필요해진 것은 전화한 결과예요.",
          "feedback": "도움이 먼저 필요했고 그래서 전화했어요. 문장의 뒤쪽은 전화한 이유예요."
        },
        {
          "id": "reason",
          "text": "because · 도움이 필요했던 것이 전화한 이유예요.",
          "feedback": "맞아요. ‘왜 전화했지?’에 I needed help가 답하고, because가 그 이유를 소개해요."
        }
      ]
    }
  }
]
$grammar_foundations$::jsonb) loop
    insert into public.grammar_content_versions(goal_id, version, content)
      values (lesson->>'goalId', (lesson->>'version')::integer, lesson) on conflict do nothing;
    select content into strict existing from public.grammar_content_versions
      where goal_id = lesson->>'goalId' and version = (lesson->>'version')::integer;
    if existing is distinct from lesson then
      raise exception 'grammar_version_conflict: %/%', lesson->>'goalId', lesson->>'version';
    end if;
  end loop;
end $$;

commit;
