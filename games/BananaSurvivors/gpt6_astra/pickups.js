// Small illustrated sprites are painted once, then reused for every pickup.
export const SUPPLIES = {
  heal: { color: "#ff9ca7", name: "Field medicine", detail: "+25 health" },
  magnet: {
    color: "#c2a3ff",
    name: "Salvage magnet",
    detail: "Collect all XP",
  },
  frenzy: {
    color: "#ffcf58",
    name: "Overripe fuel",
    detail: "9 seconds of rapid fire",
  },
  nuke: {
    color: "#ffad6c",
    name: "Spore grenade",
    detail: "Damage the surrounding horde",
  },
  ward: {
    color: "#82e8d4",
    name: "Peel ward",
    detail: "Block one hit within 16 seconds",
  },
  frost: {
    color: "#a4dfff",
    name: "Frost fruit",
    detail: "Slow the horde for 7 seconds",
  },
};
export function createPickupSprites() {
  const sprites = {};
  for (const kind of ["xp", "xp-rich", "xp-rare", ...Object.keys(SUPPLIES)]) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 96;
    const g = canvas.getContext("2d"),
      color =
        SUPPLIES[kind]?.color ||
        { xp: "#f6c34c", "xp-rich": "#76e5c4", "xp-rare": "#c7a3ff" }[kind];
    g.translate(48, 48);
    const path = (points, fill, stroke = "#17271f", width = 3) => {
      g.beginPath();
      points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      g.strokeStyle = stroke;
      g.lineWidth = width;
      g.lineJoin = "round";
      g.stroke();
    };
    const line = (points, stroke, width) => {
      g.beginPath();
      points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = stroke;
      g.lineWidth = width;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.stroke();
    };
    if (kind.startsWith("xp")) {
      path(
        [
          [0, -30],
          [22, -13],
          [18, 13],
          [0, 31],
          [-18, 13],
          [-22, -13],
        ],
        color,
        "#17281f",
        4,
      );
      path(
        [
          [0, -30],
          [0, 4],
          [-22, -13],
        ],
        "#fff7ce",
        color,
        1,
      );
      path(
        [
          [0, 4],
          [22, -13],
          [18, 13],
          [0, 31],
        ],
        kind === "xp" ? "#ba7929" : "#397c78",
        color,
        1,
      );
      line(
        [
          [-12, -10],
          [0, -19],
          [8, -13],
        ],
        "#ffffff",
        3,
      );
    } else {
      const glow = g.createRadialGradient(0, 0, 10, 0, 0, 45);
      glow.addColorStop(0, color + "88");
      glow.addColorStop(1, color + "00");
      g.fillStyle = glow;
      g.fillRect(-48, -48, 96, 96);
      path(
        [
          [-28, -13],
          [-13, -29],
          [15, -29],
          [29, -13],
          [29, 13],
          [13, 29],
          [-13, 29],
          [-28, 13],
        ],
        "#172d26",
        color,
        2,
      );
      if (kind === "heal") {
        path(
          [
            [-18, -14],
            [18, -14],
            [22, 19],
            [-22, 19],
          ],
          "#e9d9ab",
        );
        line(
          [
            [-8, -15],
            [-8, -22],
            [8, -22],
            [8, -15],
          ],
          "#ebd8ae",
          4,
        );
        line(
          [
            [0, -5],
            [0, 12],
          ],
          "#af3b46",
          7,
        );
        line(
          [
            [-8, 3],
            [8, 3],
          ],
          "#af3b46",
          7,
        );
      } else if (kind === "magnet") {
        line(
          [
            [-14, -18],
            [-14, 9],
            [-8, 16],
            [8, 16],
            [14, 9],
            [14, -18],
          ],
          color,
          11,
        );
        line(
          [
            [-14, -18],
            [-14, -10],
          ],
          "#fff0d2",
          9,
        );
        line(
          [
            [14, -18],
            [14, -10],
          ],
          "#fff0d2",
          9,
        );
      } else if (kind === "ward") {
        path(
          [
            [0, -23],
            [20, -14],
            [16, 10],
            [0, 25],
            [-16, 10],
            [-20, -14],
          ],
          color,
        );
        path(
          [
            [0, -16],
            [0, 16],
            [-10, 6],
            [-13, -9],
          ],
          "#e6ffe7",
          color,
          1,
        );
      } else if (kind === "frost") {
        for (let i = 0; i < 6; i++) {
          g.save();
          g.rotate((i * Math.PI) / 3);
          line(
            [
              [0, 0],
              [0, -23],
            ],
            color,
            4,
          );
          line(
            [
              [-7, -15],
              [0, -10],
              [7, -15],
            ],
            color,
            3,
          );
          g.restore();
        }
      } else if (kind === "frenzy") {
        path(
          [
            [-12, -21],
            [12, -21],
            [16, 22],
            [-16, 22],
          ],
          "#785321",
          color,
          2,
        );
        path(
          [
            [4, -18],
            [-10, 3],
            [0, 3],
            [-4, 20],
            [12, -4],
            [2, -4],
          ],
          "#fff1a6",
          color,
          1,
        );
      } else {
        g.beginPath();
        g.ellipse(0, 4, 18, 21, 0, 0, Math.PI * 2);
        g.fillStyle = "#aa6b38";
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = color;
        g.stroke();
        line(
          [
            [1, -15],
            [1, -24],
            [11, -26],
          ],
          "#eee4c0",
          4,
        );
        line(
          [
            [-10, -5],
            [10, 12],
          ],
          "#ffd786",
          3,
        );
        line(
          [
            [10, -5],
            [-10, 12],
          ],
          "#ffd786",
          3,
        );
      }
      line(
        [
          [-22, -16],
          [-11, -24],
          [6, -24],
        ],
        "#fff6d966",
        2,
      );
    }
    sprites[kind] = canvas;
  }
  return sprites;
}
