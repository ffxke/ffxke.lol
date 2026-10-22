/* ✏️ STICKBOY ROOMS
   A level is a stack of FLOORS (zigzag, bottom to top, like Fireboy & Watergirl).
   Each floor is 40 tiles wide: a wall, an entry hole, ~30 tiles of random segments below, a climb ledge, a wall.
   Odd floors are flipped, so you go right on one floor, left on the next, climbing up each time.

   Every segment is exactly 6 rows: 5 rows of air + 1 floor row (the floor is the bottom row).
   Write segments as if travelling LEFT → RIGHT. The game flips / colour-swaps them randomly.

   RULES (floors have 5 tiles of headroom; stickmen jump ~3.5 high and ~4 far):
   - first and last column: air in the 5 air rows, solid floor in the bottom row
   - climbs <= 3 tiles, gaps / pools <= 3 tiles wide (2 for easy segments)
   - gates should fill the full height so nobody can jump over them

   LEGEND
   #  solid             .  air              -  one-way platform (jump up through it, S / ↓ drops)
   R  red pool  (kills blue)                B  blue pool (kills red)        G  green goo (kills both)
   r  red gem   (red only)                  b  blue gem  (blue only)
   x  pushable box      ^  button           |  gate   (closed until a button in this segment is held)
                                            =  bridge (only there while a button in this segment is held)

   tier:   0 = easy, 1 = puzzles, 2 = harder (appear from level 3)
   mirror: true if the segment also works flipped left-to-right
*/
window.STICKBOY_CHUNKS = [
  { name: "pools", tier: 0, mirror: true, rows: [
    "..........",
    "..........",
    "...r..b...",
    "..........",
    "..........",
    "##BB##RR##",
  ]},
  { name: "stairs", tier: 0, mirror: true, rows: [
    "............",
    "............",
    ".....rb.....",
    "....####....",
    "..########..",
    "############",
  ]},
  { name: "ledge", tier: 0, mirror: true, rows: [
    ".........",
    ".........",
    "...b.b...",
    "..-----..",
    "...r.r...",
    "##RRRRR##",
  ]},
  { name: "goo hop", tier: 1, mirror: true, rows: [
    "............",
    "............",
    "....r..b....",
    "............",
    "....#..#....",
    "##GG#GG#GG##",
  ]},
  { name: "gate", tier: 1, mirror: true, rows: [
    "......|......",
    "......|......",
    "......|......",
    "..b...|...r..",
    "..^...|...^..",
    "#############",
  ]},
  { name: "bridge", tier: 1, mirror: true, rows: [
    "............",
    "............",
    "............",
    "....b..r....",
    ".^========^.",
    "##GGGGGGGG##",
  ]},
  { name: "box button", tier: 2, mirror: false, rows: [
    ".........|...",
    ".........|...",
    ".........|...",
    ".........|.rb",
    "..x.....^|#..",
    "#############",
  ]},
  { name: "pool gate", tier: 2, mirror: true, rows: [
    "........|....",
    "........|....",
    "...r....|....",
    "........|.b..",
    ".^......|..^.",
    "###BB########",
  ]},
];
