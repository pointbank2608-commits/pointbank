import Matter from 'matter-js';
import { fruitStageForCount, type SentenceToken } from './sentencePatterns';
import type { TokenChange } from './sentenceTransforms';

export interface FruitData {
  id: string;
  tokens: SentenceToken[];
  agreement?: TokenChange | null;
}

export type FruitBody = Matter.Body & { fruitData: FruitData };

export interface FruitSnapshot {
  id: string;
  x: number;
  y: number;
  r: number;
  angle: number;
  tokens: SentenceToken[];
  agreement?: TokenChange | null;
}

export interface WatermelonWorld {
  engine: Matter.Engine;
  width: number;
  height: number;
  wall: number;
  dangerY: number;
  onMerge: (a: FruitBody, b: FruitBody) => boolean;
  mergeQueue: Array<[FruitBody, FruitBody]>;
}

const { Engine, World, Bodies, Body, Composite, Events } = Matter;

function considerPair(world: WatermelonWorld, a: Matter.Body, b: Matter.Body) {
  const fa = a as FruitBody;
  const fb = b as FruitBody;
  if (!fa.fruitData || !fb.fruitData || a.isStatic || b.isStatic) return;
  const queued = world.mergeQueue.some(
    ([x, y]) => (x.id === a.id && y.id === b.id) || (x.id === b.id && y.id === a.id),
  );
  if (queued) return;
  world.mergeQueue.push([fa, fb]);
}

export function createWatermelonWorld(opts: {
  width: number;
  height: number;
  wall: number;
  dangerY: number;
  onMerge: (a: FruitBody, b: FruitBody) => boolean;
}): WatermelonWorld {
  const engine = Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 1.35;
  engine.gravity.scale = 0.001;
  engine.positionIterations = 8;
  engine.velocityIterations = 6;
  const { width, height, wall } = opts;

  const floor = Bodies.rectangle(width / 2, height - wall / 2, width, wall, { isStatic: true, restitution: 0.12, friction: 0.4 });
  const left = Bodies.rectangle(wall / 2, height / 2, wall, height, { isStatic: true, restitution: 0.12, friction: 0.3 });
  const right = Bodies.rectangle(width - wall / 2, height / 2, wall, height, { isStatic: true, restitution: 0.12, friction: 0.3 });
  World.add(engine.world, [floor, left, right]);

  const world: WatermelonWorld = {
    engine,
    width,
    height,
    wall,
    dangerY: opts.dangerY,
    onMerge: opts.onMerge,
    mergeQueue: [],
  };

  Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) considerPair(world, pair.bodyA, pair.bodyB);
  });
  Events.on(engine, 'collisionActive', (event) => {
    for (const pair of event.pairs) considerPair(world, pair.bodyA, pair.bodyB);
  });

  return world;
}

export function stepWatermelonWorld(world: WatermelonWorld, deltaMs: number) {
  Engine.update(world.engine, Math.min(deltaMs, 32));
  const jobs = world.mergeQueue.splice(0);
  for (const [a, b] of jobs) {
    if (!a.fruitData || !b.fruitData) continue;
    world.onMerge(a, b);
  }
}

export function dropFruit(world: WatermelonWorld, data: FruitData, x: number, y: number): FruitBody {
  const stage = fruitStageForCount(data.tokens.length);
  const body = Bodies.circle(x, y, stage.radius, {
    restitution: 0.18,
    friction: 0.22,
    frictionAir: 0.006,
    density: 0.002,
    slop: 0.04,
  }) as FruitBody;
  body.fruitData = data;
  Body.setVelocity(body, { x: 0, y: 3 });
  World.add(world.engine.world, body);
  return body;
}

export function removeFruit(world: WatermelonWorld, body: Matter.Body) {
  Composite.remove(world.engine.world, body);
}

export function findFruit(world: WatermelonWorld, id: string): FruitBody | null {
  const found = world.engine.world.bodies.find((b) => (b as FruitBody).fruitData?.id === id);
  return found ? (found as FruitBody) : null;
}

export function snapshotFruits(world: WatermelonWorld): FruitSnapshot[] {
  return world.engine.world.bodies
    .filter((b): b is FruitBody => Boolean((b as FruitBody).fruitData) && !b.isStatic)
    .map((b) => ({
      id: b.fruitData.id,
      x: b.position.x,
      y: b.position.y,
      r: (b.circleRadius as number) ?? fruitStageForCount(b.fruitData.tokens.length).radius,
      angle: b.angle,
      tokens: b.fruitData.tokens,
      agreement: b.fruitData.agreement ?? null,
    }));
}

export function overflowBodies(world: WatermelonWorld): FruitBody[] {
  return world.engine.world.bodies.filter((b): b is FruitBody => {
    if (!((b as FruitBody).fruitData) || b.isStatic) return false;
    const r = (b.circleRadius as number) ?? 0;
    const settled = Math.abs(b.velocity.y) < 0.35 && Math.abs(b.velocity.x) < 0.35;
    return settled && b.position.y - r < world.dangerY;
  });
}

export function destroyWatermelonWorld(world: WatermelonWorld) {
  Events.off(world.engine, 'collisionStart');
  Events.off(world.engine, 'collisionActive');
  World.clear(world.engine.world, false);
  Engine.clear(world.engine);
}

export function clampDropX(width: number, wall: number, x: number, radius: number): number {
  const min = wall + radius + 4;
  const max = width - wall - radius - 4;
  return Math.min(max, Math.max(min, x));
}

export function setBodySleep(body: Matter.Body, sleep: boolean) {
  Body.setStatic(body, sleep);
}
