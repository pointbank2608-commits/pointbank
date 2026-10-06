-- 사전 검수 수정 (2026-10-07): 뜻·예문·표기 고침. 단어 중복·민감 단어는 사용자 결정으로 그대로 둔다.
-- 근거 목록: app/scripts/vocab/out/review-L1-L4-proposals.md
-- 읽기 전용 확인은 마지막 select 로 한다(수정된 행 수 = 아래 update 개수와 같아야 함).
begin;

-- 뜻
update public.word_bank set meaning = '심장, 마음' where id = 'heart';
update public.word_bank set meaning = '뒤로, 되돌아' where id = 'back';
update public.word_bank set meaning = '밖으로, 밖에' where id = 'out';
update public.word_bank set meaning = '위로' where id = 'up';
update public.word_bank set meaning = '너, 너희' where id = 'you';
update public.word_bank set meaning = '뽀뽀하다' where id = 'kiss';
update public.word_bank set meaning = '수프' where id = 'soup';
update public.word_bank set meaning = '~해 주세요' where id = 'please';
update public.word_bank set meaning = '아니요' where id = 'no';
update public.word_bank set meaning = '나이 든, 오래된' where id = 'old';
update public.word_bank set meaning = '소, 젖소' where id = 'cow';
update public.word_bank set meaning = '잡다, 가져가다' where id = 'take';
update public.word_bank set meaning = '저것, 그것' where id = 'that';
update public.word_bank set meaning = '트럭' where id = 'truck';
update public.word_bank set meaning = '그릇' where id = 'bowl';
update public.word_bank set meaning = '카메라' where id = 'camera';
update public.word_bank set meaning = '램프, 전등' where id = 'lamp';
update public.word_bank set meaning = '말하다, 알려 주다' where id = 'tell';
update public.word_bank set meaning = '마을, 동네' where id = 'town';
update public.word_bank set meaning = '채소' where id = 'vegetable';
update public.word_bank set meaning = '어느 것, 어느' where id = 'which';
update public.word_bank set meaning = '~ 가까이에' where id = 'near';
update public.word_bank set meaning = '자주' where id = 'often';
update public.word_bank set meaning = '~하게 해 주다' where id = 'let';
update public.word_bank set meaning = '잃어버리다, 지다' where id = 'lose';
update public.word_bank set meaning = '좋은, 괜찮은' where id = 'fine';
update public.word_bank set meaning = '상추, 양상추' where id = 'lettuce';
update public.word_bank set meaning = '불에 타다' where id = 'burn';
update public.word_bank set meaning = '주장, 선장' where id = 'captain';
update public.word_bank set meaning = '신경 쓰다, 아끼다' where id = 'care-1';
update public.word_bank set meaning = '홀, 강당' where id = 'hall';
update public.word_bank set meaning = '정글, 밀림' where id = 'jungle';
update public.word_bank set meaning = '사실인' where id = 'true';
update public.word_bank set meaning = '표지판, 신호' where id = 'sign';
update public.word_bank set meaning = '기록하다, 녹음하다' where id = 'record';
update public.word_bank set meaning = '함께 활동하다' where id = 'work-together';
update public.word_bank set meaning = '모둠을 만들다' where id = 'make-a-group';
update public.word_bank set meaning = '번갈아 하다' where id = 'take-turns';
update public.word_bank set meaning = '~선생님, ~양 (여성 호칭)' where id = 'Miss';
update public.word_bank set meaning = '~씨, ~선생님 (남성 호칭)' where id = 'Mr';
update public.word_bank set meaning = '~부인, ~선생님 (결혼한 여성 호칭)' where id = 'Mrs';
update public.word_bank set meaning = '부인, 선생님 (여성 호칭)' where id = 'ma''am';
update public.word_bank set meaning = '실례하다, 양해를 구하다' where id = 'excuse';
update public.word_bank set meaning = '양해를 구하다' where id = 'pardon';
update public.word_bank set meaning = '형, 오빠, 남동생' where id = 'brother';
update public.word_bank set meaning = '누나, 언니, 여동생' where id = 'sister';
update public.word_bank set meaning = '집, 가정' where id = 'home';
update public.word_bank set meaning = '집, 주택' where id = 'house';
update public.word_bank set meaning = '배 (과일)' where id = 'pear';
update public.word_bank set meaning = '배 (작은 배)' where id = 'boat';
update public.word_bank set meaning = '배 (큰 배)' where id = 'ship';
update public.word_bank set meaning = '들리다, 듣다' where id = 'hear';
update public.word_bank set meaning = '귀 기울여 듣다' where id = 'listen';
update public.word_bank set meaning = '배 (몸), 위' where id = 'stomach';

-- 설날: 1월 1일은 "새해 첫날", 설날은 Seollal/Lunar New Year 따로 있음
update public.word_bank set meaning = '새해 첫날 (1월 1일)', example_sentence = 'We say Happy New Year on New Year''s Day.' where id = 'new-year-s-day';

-- 예문
update public.word_bank set example_sentence = 'I play after school.' where id = 'after';
update public.word_bank set example_sentence = 'I wash my hands.' where id = 'hand';
update public.word_bank set example_sentence = 'My tooth hurts.' where id = 'tooth';
update public.word_bank set example_sentence = 'We have a party today.' where id = 'party';
update public.word_bank set example_sentence = 'Tea or juice?' where id = 'or';
update public.word_bank set example_sentence = 'We have fun at the park.' where id = 'fun';
update public.word_bank set example_sentence = 'Goodbye! See you tomorrow.' where id = 'goodbye';
update public.word_bank set example_sentence = 'Blow out the candle.' where id = 'candle';
update public.word_bank set example_sentence = 'I don''t have much water.' where id = 'much';
update public.word_bank set example_sentence = 'Piano practice is fun.' where id = 'practice';
update public.word_bank set example_sentence = 'My legs are weak.' where id = 'weak';
update public.word_bank set example_sentence = 'She has red cheeks.' where id = 'cheek';
update public.word_bank set example_sentence = 'I have a new jump rope.' where id = 'jump-rope';
update public.word_bank set example_sentence = 'I have an interest in art.' where id = 'interest';
update public.word_bank set example_sentence = 'I send a letter by post.' where id = 'post';
update public.word_bank set example_sentence = 'The train has great speed.' where id = 'speed';
update public.word_bank set example_sentence = 'I like sports.' where id = 'sport';
update public.word_bank set example_sentence = 'My aunt has a daughter.' where id = 'daughter';
update public.word_bank set example_sentence = 'My uncle has a son.' where id = 'son';

-- 표기
update public.word_bank set word = 'Lego' where id = 'lego';
update public.word_bank set word = 'Children''s Day' where id = 'children-s-day';
update public.word_bank set word = 'Parents'' Day' where id = 'parents-day';
update public.word_bank set word = 'Teacher''s Day' where id = 'teacher-s-day';

-- 파닉스 뜻
update public.phonics_bank set meaning = '통통한' where id = 'fat-s2';
update public.phonics_bank set meaning = '큰 배' where id = 'ship-s4';
update public.phonics_bank set meaning = '보트' where id = 'boat-s5';

commit;

-- 확인(읽기 전용): 아래 세 줄이 모두 true 여야 한다
select
  (select count(*) from public.word_bank where id = 'soup' and meaning = '수프') = 1 as soup_ok,
  (select count(*) from public.word_bank where id = 'lego' and word = 'Lego') = 1 as lego_ok,
  (select count(*) from public.phonics_bank where id = 'fat-s2' and meaning = '통통한') = 1 as phonics_ok;
