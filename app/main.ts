import _ from 'lodash';

class TileContstraintSpriteMovement {
    spriteTilePosition: Phaser.Point;
    spriteTurnPoint: Phaser.Point;
    gridsize: number;
    threshold: number;
    directionTiles: Array;
    currentDirection: number;
    nextDirection: number;
    speed: number;
    opposites: Array;

    constructor(public map: Phaser.Tilemap, public layer:Phaser.TilemapLayer, public sprite: Phaser.Sprite) {
        this.spriteTilePosition = new Phaser.Point();
        this.spriteTurnPoint = new Phaser.Point();
        this.opposites = [ Phaser.NONE, Phaser.RIGHT, Phaser.LEFT, Phaser.DOWN, Phaser.UP ];

        this.gridsize = 32;
        this.threshold = 3;
        this.speed = 100;

        this.directionTiles = [];
        this.currentDirection = Phaser.NONE;
        this.nextDirection = Phaser.NONE;

        this.spriteTilePosition = getSpriteTilePosition(this.sprite, this.spriteTilePosition);
        this.updateDirectionTiles();
        this.spriteTurnPoint = this.calculateNextSpriteTurnPoint(this.currentDirection, this.spriteTurnPoint);
    }

    updateDirectionTiles() {
        this.directionTiles[Phaser.NONE] = this.map.getTile(this.spriteTilePosition.x, this.spriteTilePosition.y, this.layer);
        this.directionTiles[Phaser.LEFT] = this.map.getTileLeft(this.layer.index, this.spriteTilePosition.x, this.spriteTilePosition.y);
        this.directionTiles[Phaser.RIGHT] = this.map.getTileRight(this.layer.index, this.spriteTilePosition.x, this.spriteTilePosition.y);
        this.directionTiles[Phaser.UP] = this.map.getTileAbove(this.layer.index, this.spriteTilePosition.x, this.spriteTilePosition.y);
        this.directionTiles[Phaser.DOWN] = this.map.getTileBelow(this.layer.index, this.spriteTilePosition.x, this.spriteTilePosition.y);
    }

    update() {
        this.spriteTilePosition = getSpriteTilePosition(this.sprite, this.spriteTilePosition);

        this.updateDirectionTiles();

        if (isSpriteOnTile(this.sprite, this.spriteTurnPoint, this.threshold)) {
            this.nextDirection = this.updateNextDirection();
            this.calibrateSpritePosition(this.spriteTurnPoint);
            this.move(this.moveIntent(this.nextDirection, this.currentDirection));
            this.spriteTurnPoint = this.calculateNextSpriteTurnPoint(this.currentDirection, this.spriteTurnPoint);
        }

        if(this.currentDirection === this.opposites[this.nextDirection] || this.currentDirection === Phaser.NONE) {
            this.currentDirection = this.nextDirection;
            this.move(this.moveIntent(this.nextDirection, this.currentDirection));
            this.spriteTurnPoint = this.calculateNextSpriteTurnPoint(this.currentDirection, this.spriteTurnPoint);
        }
    }

    updateNextDirection() {
        return this.nextDirection;
    }

    calibrateSpritePosition(spriteTurnPoint: Phaser.Point) {
        this.sprite.x = spriteTurnPoint.x;
        this.sprite.y = spriteTurnPoint.y;
        this.sprite.body.reset(spriteTurnPoint.x, spriteTurnPoint.y);
    }

    calculateNextSpriteTurnPoint(direction, output) {
        output = output || new Phaser.Point();
        var directionTile = this.directionTiles[direction];
        output = getTilePixelPosition(directionTile, output);
        return output;
    }

    move(direction) {
        var speed = this.speed;

        if (direction === Phaser.LEFT || direction === Phaser.UP) {
            speed = -speed;
        }

        if (direction === Phaser.LEFT || direction === Phaser.RIGHT) {
            this.sprite.body.velocity.x = speed;
        }
        else if (direction === Phaser.UP || direction === Phaser.DOWN) {
            this.sprite.body.velocity.y = speed;
        }
        else {
            this.sprite.body.velocity.x = 0;
            this.sprite.body.velocity.y = 0;
        }

        this.currentDirection = direction;
    }

    moveIntent(nextDirection, currentDirection) {
        if (this.canMove(nextDirection)) {
            return nextDirection;
        }

        if (this.canMove(currentDirection)) {
            return currentDirection;
        }

        return Phaser.NONE;
    }

    canMove(direction) {
        var directionTile = this.directionTiles[direction];
        return !directionTile.collides;
    }
}

class RandomTileConstraintSpriteMovement extends TileContstraintSpriteMovement {
    updateNextDirection() {
        let allDirections = [Phaser.LEFT, Phaser.RIGHT, Phaser.UP, Phaser.DOWN];
        let possibleDirections = _.filter(allDirections, (direction) => {
            return direction !== this.currentDirection && direction !== this.opposites[this.currentDirection];
        });
        this.nextDirection = _.sample(possibleDirections);
        return this.nextDirection;
    }
}

class PathfinderTileConstraintSpriteMovement extends TileContstraintSpriteMovement {
    constructor(
        public map: Phaser.Tilemap,
        public layer: Phaser.TilemapLayer,
        public sprite: Phaser.Sprite,
        public mainCharacter: Shapman,
        public pathfinder
    ) {
        super(map, layer, sprite);
    }

    updateNextDirection() {
        let pacmanSpriteTilePosition = this.mainCharacter.movement.spriteTilePosition;
        let ghostSpriteTilePosition = getSpriteTilePosition(this.sprite);
        var path = [];
        this.pathfinder.setCallbackFunction((calculatedPath) => {
            path = calculatedPath;
        });
        this.pathfinder.preparePathCalculation([ghostSpriteTilePosition.x, ghostSpriteTilePosition.y], [pacmanSpriteTilePosition.x, pacmanSpriteTilePosition.y]);
        this.pathfinder.calculatePath();

        if(path && path[1]) {
            let p = path[1];
            if(p.x > ghostSpriteTilePosition.x) {
                return Phaser.RIGHT;
            }
            if(p.x < ghostSpriteTilePosition.x) {
                return Phaser.LEFT;
            }
            if(p.y > ghostSpriteTilePosition.y) {
                return Phaser.DOWN;
            }
            if(p.y < ghostSpriteTilePosition.y) {
                return Phaser.UP;
            }
        }
        return Phaser.NONE;
    }
}

class GhostGoHomeConstraintSpriteMovement extends TileContstraintSpriteMovement {
    constructor(
        public map: Phaser.Tilemap,
        public layer: Phaser.TilemapLayer,
        public sprite: Phaser.Sprite,
        public ghost: Ghost,
        public pathfinder
    ) {
        super(map, layer, sprite);
    }

    updateNextDirection() {
        let ghostSpriteTilePosition = getSpriteTilePosition(this.sprite);
        var path = [];
        this.pathfinder.setCallbackFunction((calculatedPath) => {
            path = calculatedPath;
        });
        this.pathfinder.preparePathCalculation([ghostSpriteTilePosition.x, ghostSpriteTilePosition.y], [this.ghost.xTile, this.ghost.yTile]);
        this.pathfinder.calculatePath();

        if(path && path[1]) {
            let p = path[1];
            if(p.x > ghostSpriteTilePosition.x) {
                return Phaser.RIGHT;
            }
            if(p.x < ghostSpriteTilePosition.x) {
                return Phaser.LEFT;
            }
            if(p.y > ghostSpriteTilePosition.y) {
                return Phaser.DOWN;
            }
            if(p.y < ghostSpriteTilePosition.y) {
                return Phaser.UP;
            }
        }
        return Phaser.NONE;
    }
}

class DoubleTileConstraintSpriteMovement extends TileContstraintSpriteMovement {
    directionTiles2: Array;
    sprite2: Phaser.Sprite;

    constructor(public map: Phaser.Tilemap, public layer: Phaser.TilemapLayer, public sprite: Phaser.Sprite, public sprite2: Phaser.Sprite) {
        this.directionTiles2 = [];
        super(map, layer, sprite);
        let originalPostUpdate = this.sprite.body.postUpdate.bind(this.sprite.body);
        this.sprite.body.postUpdate = () => {
            originalPostUpdate();
            this.sprite2.x = this.sprite.x;
            this.sprite2.y = this.sprite.y - 32;
        }
    }

    updateDirectionTiles() {
        super.updateDirectionTiles();
        let spriteTilePosition2 = new Phaser.Point(this.spriteTilePosition.x, this.spriteTilePosition.y - 1);
        this.directionTiles2[Phaser.NONE] = this.map.getTile(spriteTilePosition2.x, spriteTilePosition2.y, this.layer);
        this.directionTiles2[Phaser.LEFT] = this.map.getTileLeft(this.layer.index, spriteTilePosition2.x, spriteTilePosition2.y);
        this.directionTiles2[Phaser.RIGHT] = this.map.getTileRight(this.layer.index, spriteTilePosition2.x, spriteTilePosition2.y);
        this.directionTiles2[Phaser.UP] = this.map.getTileAbove(this.layer.index, spriteTilePosition2.x, spriteTilePosition2.y);
        this.directionTiles2[Phaser.DOWN] = this.map.getTileBelow(this.layer.index, spriteTilePosition2.x, spriteTilePosition2.y);
    }

    canMove(direction) {
        var directionTile = this.directionTiles[direction];
        var directionTile2 = this.directionTiles2[direction];
        return !directionTile.collides && !directionTile2.collides;
    }
}

enum ShapmanState {
    Strong,
    Weak
}

class Shapman {
    movement: TileContstraintSpriteMovement;
    sprite: Phaser.Sprite;
    sprite2: Phaser.Sprite;
    nextDirection: number;
    lastDirection: number;
    group: Phaser.Group;
    state: ShapmanState;

    constructor(public tileX:number, public tileY:number, private game: GameState, private map: Phaser.Tilemap, private layer: Phaser.TilemapLayer) {
        this.state = ShapmanState.Strong;
        this.nextDirection = Phaser.NONE;

        this.sprite = game.add.sprite(tileX * 32 + 16, tileY * 32 + 16, 'sprites', 54);
        this.sprite.anchor.set(0.5);

        this.group = game.add.group();
        this.group.add(this.sprite);
        //this.sprite2 = game.add.sprite(48, 48, 'sprites', 54);
        //this.sprite2.anchor.set(0.5);

        this.sprite.animations.add('walkRight', [54, 55]);
        this.sprite.animations.add('walkDown', [54, 56]);
        this.sprite.animations.add('walkLeft', [54, 57]);
        this.sprite.animations.add('walkUp', [54, 58]);
        this.sprite.animations.add('stand', [54]);

        //this.sprite.animations.play('walkDown', 5, true);
        game.physics.enable(this.sprite);
        this.sprite.body.collideWorldBounds = true;

        this.movement = new TileContstraintSpriteMovement(map, this.layer, this.sprite);
    }

    update() {
        if(this.lastDirection !== this.movement.currentDirection) {
            if(this.movement.currentDirection === Phaser.UP) {
                this.sprite.animations.play('walkUp', 5, true);
            }
            else if(this.movement.currentDirection === Phaser.LEFT) {
                this.sprite.animations.play('walkLeft', 5, true);
            }
            else if(this.movement.currentDirection === Phaser.RIGHT) {
                this.sprite.animations.play('walkRight', 5, true);
            }
            else if(this.movement.currentDirection === Phaser.DOWN) {
                this.sprite.animations.play('walkDown', 5, true);
            }
        }
        this.lastDirection = this.movement.currentDirection;
        this.movement.nextDirection = this.nextDirection;
        this.movement.update();
    }

    grow() {
        this.state = ShapmanState.Strong;
        if(!this.sprite2) {
            this.sprite2 = this.game.add.sprite(this.sprite.x, this.sprite.y - 32, 'sprites', 54);
            this.game.physics.enable(this.sprite2);
            this.sprite2.anchor.set(0.5);
            this.group.add(this.sprite2);
            let oldMovement = this.movement;
            this.movement = new DoubleTileConstraintSpriteMovement(this.map, this.layer, this.sprite, this.sprite2);
            this.movement = copyRelevantMovementProperties(this.movement, oldMovement);
        }
    }

    shrink() {
        this.state = ShapmanState.Weak;
        if(this.sprite2) {
            this.group.remove(this.sprite2);
            this.sprite2.destroy();
            this.sprite2 = null;
            let oldMovement = this.movement;
            this.movement = new TileContstraintSpriteMovement(this.map, this.layer, this.sprite);
            this.movement = copyRelevantMovementProperties(this.movement, oldMovement);
        }
    }

    restart() {
        this.state = ShapmanState.Strong;
        this.grow();
        this.sprite.x = this.tileX * 32 + 16;
        this.sprite.y = this.tileY * 32 + 16;
        this.movement.calibrateSpritePosition(new Phaser.Point(this.sprite.x, this.sprite.y));
    }
}

function copyRelevantMovementProperties(newMovement:TileContstraintSpriteMovement, oldMovement:TileContstraintSpriteMovement) {
    newMovement.currentDirection = oldMovement.currentDirection;
    newMovement.nextDirection = oldMovement.nextDirection;
    newMovement.spriteTilePosition = oldMovement.spriteTilePosition;
    newMovement.spriteTurnPoint = oldMovement.spriteTurnPoint;
    return newMovement;
}

enum GhostState {
    Hunting,
    Cruising,
    Eaten
}

class Ghost {
    movement: RandomTileConstraintSpriteMovement;
    sprite: Phaser.Sprite;
    lastDirection: number;
    state: GhostState;
    lastState: GhostState;

    constructor(public xTile: number, public yTile:number, game: Phaser.Game, private map: Phaser.Tilemap, private layer:Phaser.TilemapLayer, private mainCharacter: Shapman, private pathfinder) {
        this.sprite = game.add.sprite(xTile*32+16, yTile*32+16, 'sprites', 60);
        this.sprite.anchor.set(0.5);
        this.state = GhostState.Cruising;

        this.sprite.animations.add('huntingWalkLeft', [60, 61]);
        this.sprite.animations.add('huntingWalkUp', [62, 63]);
        this.sprite.animations.add('huntingWalkRight', [64, 65]);
        this.sprite.animations.add('huntingWalkDown', [66, 67]);

        this.sprite.animations.add('cruisingWalkLeft', [114, 115]);
        this.sprite.animations.add('cruisingWalkUp', [116, 117]);
        this.sprite.animations.add('cruisingWalkRight', [118, 119]);
        this.sprite.animations.add('cruisingWalkDown', [120, 121]);

        this.sprite.animations.add('eatenWalkLeft', [68, 69, 70, 71]);
        this.sprite.animations.add('eatenWalkUp', [68, 69, 70, 71]);
        this.sprite.animations.add('eatenWalkRight', [68, 69, 70, 71]);
        this.sprite.animations.add('eatenWalkDown', [68, 69, 70, 71]);

        this.sprite.animations.play('cruisingWalkRight', 10, true);
        game.physics.enable(this.sprite);
        this.sprite.body.collideWorldBounds = true;
        this.sprite.body.setSize(8, 8);

        this.movement = new RandomTileConstraintSpriteMovement(this.map, this.layer, this.sprite);
    }

    changeState(newState: GhostState) {
        if(this.state !== newState) {
            this.state = newState;
            let oldMovement = this.movement;

            if(this.state === GhostState.Hunting) {
                this.movement = new PathfinderTileConstraintSpriteMovement(this.map, this.layer, this.sprite, this.mainCharacter, this.pathfinder);
            }
            else if(this.state === GhostState.Cruising) {
                this.movement = new RandomTileConstraintSpriteMovement(this.map, this.layer, this.sprite);
            }
            else if(this.state === GhostState.Eaten) {
                this.movement = new GhostGoHomeConstraintSpriteMovement(this.map, this.layer, this.sprite, this, this.pathfinder);
            }

            this.movement = copyRelevantMovementProperties(this.movement, oldMovement);
        }
    }

    hunt() {
        if([GhostState.Hunting, GhostState.Cruising].includes(this.state)) {
            this.changeState(GhostState.Hunting);
        }
    }

    cruise(force:boolean=false) {
        if(force || [GhostState.Hunting, GhostState.Cruising].includes(this.state)) {
            this.changeState(GhostState.Cruising);
        }
    }

    eaten() {
        if([GhostState.Hunting, GhostState.Cruising].includes(this.state)) {
            this.changeState(GhostState.Eaten);
        }
    }

    update() {
        this.movement.update();
        if(this.lastDirection !== this.movement.currentDirection || this.state !== this.lastState) {
            let statePrefix = 'hunting';
            if(this.state === GhostState.Cruising) {
                statePrefix = 'cruising';
            }
            if(this.state === GhostState.Eaten) {
                statePrefix = 'eaten';
                if(this.movement.spriteTilePosition.x === this.xTile && this.movement.spriteTilePosition.y === this.yTile) {
                    this.cruise(true);
                }
            }

            if(this.movement.currentDirection === Phaser.UP) {
                this.sprite.animations.play(statePrefix + 'WalkUp', 5, true);
            }
            else if(this.movement.currentDirection === Phaser.LEFT) {
                this.sprite.animations.play(statePrefix + 'WalkLeft', 5, true);
            }
            else if(this.movement.currentDirection === Phaser.RIGHT) {
                this.sprite.animations.play(statePrefix + 'WalkRight', 5, true);
            }
            else if(this.movement.currentDirection === Phaser.DOWN) {
                this.sprite.animations.play(statePrefix + 'WalkDown', 5, true);
            }
        }

        this.lastDirection = this.movement.currentDirection;
        this.lastState = this.state;
    }
}

class Level {
    constructor(public gameState: GameState, public map: Phaser.Tilemap, public layer:Phaser.TilemapLayer) {
        this.gameState.diamondGroup = this.gameState.add.group();
        this.gameState.ghosts = [];
        this.gameState.powerUps = [];
        this.gameState.shrinks = [];
    }

    loadSpecialSprites() {
        for(let x = 0; x < this.map.width; x += 1) {
            for (let y = 0; y < this.map.height; y += 1) {
                let tile = this.map.getTile(x, y, this.layer);
                if (tile && tile.index === 96) {
                    this.map.putTile(1, x, y, this.layer);
                    this.gameState.shapman = new Shapman(x, y, this.gameState, this.gameState.map, this.gameState.layer);
                    this.gameState.shapman.grow();
                }

                if(tile && tile.index === 60) {
                    this.map.putTile(1, x, y, this.layer);

                    let diamondSprite = this.gameState.add.sprite(x * 32 + 16, y * 32 + 16, 'sprites', 59);
                    diamondSprite.anchor.set(0.5);
                    this.gameState.physics.enable(diamondSprite);
                    diamondSprite.body.setSize(8, 8);
                    this.gameState.diamondGroup.add(diamondSprite);
                }

                if(tile && [95, 98].includes(tile.index)) {
                    this.map.putTile(1, x, y, this.layer);

                    let powerUpSprite = this.gameState.add.sprite(x*32+16, y*32+16, 'sprites', 97);
                    powerUpSprite.anchor.set(0.5);
                    this.gameState.physics.enable(powerUpSprite);
                    powerUpSprite.body.setSize(16, 16);
                    this.gameState.powerUps.push(powerUpSprite);
                }

                if(tile && [99].includes(tile.index)) {
                    this.map.putTile(1, x, y, this.layer);

                    let shrinkSprite = this.gameState.add.sprite(x*32+16, y*32+16, 'sprites', 98);
                    shrinkSprite.anchor.set(0.5);
                    this.gameState.physics.enable(shrinkSprite);
                    shrinkSprite.body.setSize(16, 16);
                    this.gameState.shrinks.push(shrinkSprite);
                }
            }
        }

        for(let x = 0; x < this.map.width; x += 1) {
            for(let y = 0; y < this.map.height; y += 1) {
                let tile = this.map.getTile(x, y, this.layer);

                if(tile && [91, 92, 93, 94].includes(tile.index)) {
                    this.map.putTile(1, x, y);
                    this.gameState.ghosts.push(new Ghost(x, y, this.gameState.game, this.map, this.layer, this.gameState.shapman, this.gameState.pathfinder));
                }

            }
        }
    }
}

class GameState extends Phaser.State {
    level: Level;
    levelNumber: number;
    diamondGroup: Phaser.Group;
    shapman: Shapman;
    ghosts: Ghost[];
    map: Phaser.Tilemap;
    layer: Phaser.TilemapLayer;
    powerUps: Phaser.Sprite[];
    shrinks: Phaser.Sprite[];

    init(levelNumber) {
        this.physics.startSystem(Phaser.Physics.ARCADE);
        this.levelNumber = levelNumber;

    }

    preload() {
        this.load.tilemap('tilemap', 'app/assets/level1.json', null, Phaser.Tilemap.TILED_JSON);
        this.load.image('tiles', 'app/assets/pacback.png');
        this.load.spritesheet('sprites', 'app/assets/pacback.png', 32, 32, -1, 1, 1);
        this.load.audio('bu', ['app/assets/bu-lively-and-hidden.mp3']);
        this.load.audiosprite('sfx', ['app/assets/sfx.mp3'], 'app/assets/sfx.json');
    }

    create() {
        this.map = this.add.tilemap('tilemap');
        this.map.addTilesetImage('pacback', 'tiles');
        this.layer = this.map.createLayer(`Kachelebene ${this.levelNumber}`);

        let walkables = [0, 1].concat(_.range(41, 255));
        this.pathfinder = game.plugins.add(Phaser.Plugin.PathFinderPlugin);
        this.pathfinder.setGrid(this.map.layers[0].data, walkables);

        this.cursors = this.input.keyboard.createCursorKeys();

        this.map.setCollisionBetween(2, 40, true, this.layer);

        this.level = new Level(this, this.map, this.layer);
        this.level.loadSpecialSprites();

        let music = this.add.audio('bu');
        music.play('', 0, 1, true);

        this.sfx = this.add.audioSprite('sfx');
        this.sfx.allowMultiple = true;

        let style = { font: "26px Thirteen Pixel Fonts Regular", fill: 'white', align: "right" };
        this.startText = this.add.text(10, 440, `Points ${this.game.points}`, style);
        this.livesText = this.add.text(320, 440, `Lives ${this.game.lives}`, style);
    }

    checkKeys() {
        if (this.cursors.left.isDown) {
            this.shapman.nextDirection = Phaser.LEFT;
        }
        else if (this.cursors.right.isDown) {
            this.shapman.nextDirection = Phaser.RIGHT;
        }
        else if (this.cursors.up.isDown) {
            this.shapman.nextDirection = Phaser.UP;
        }
        else if (this.cursors.down.isDown) {
            this.shapman.nextDirection = Phaser.DOWN;
        }
    }

    update() {
        this.checkKeys();
        this.shapman.update();

        for(let ghost of this.ghosts) {
            ghost.update();
        }

        this.diamondGroup.forEachAlive((diamond) => {
            if(this.physics.arcade.overlap(this.shapman.group, diamond)) {
                diamond.kill();
                this.game.points += 10;
                this.startText.text = `Points ${this.game.points}`;

                if(this.diamondGroup.countLiving() === 0) {
                    this.state.start('GameState', true, false, 1);
                    this.game.points += 100;
                    this.startText.text = `Points ${this.game.points}`;
                }
            }
        });

        for(let powerUp of this.powerUps) {
            if(this.physics.arcade.overlap(this.shapman.group, powerUp)) {
                this.shapman.grow();
                powerUp.kill();
                this.sfx.play('powerup');

                let timer = this.time.create(true);
                timer.add(5000, () => {
                    powerUp.revive();
                });
                timer.start();

                for(let ghost of this.ghosts) {
                    ghost.cruise();
                }
            }
        }

        for(let shrink of this.shrinks) {
            if(this.physics.arcade.overlap(this.shapman.group, shrink)) {
                this.shapman.shrink();
                shrink.kill();
                this.sfx.play('shrink');

                let timer = this.time.create(true);
                timer.add(5000, () => {
                    shrink.revive();
                });
                timer.start();

                for(let ghost of this.ghosts) {
                    ghost.hunt();
                }
            }
        }

        for(let ghost of this.ghosts) {
            if(this.physics.arcade.overlap(this.shapman.group, ghost.sprite)) {
                if(this.shapman.state === ShapmanState.Weak && [GhostState.Hunting, GhostState.Cruising].includes(ghost.state)) {
                    this.sfx.play('hurt');
                    this.shapman.restart();
                    this.game.lives -= 1;
                    this.livesText.text = `Lives ${this.game.lives}`;
                    if(this.game.lives < 0) {
                        this.state.start('GameOverState');
                    }
                    for(let ghost1 of this.ghosts) {
                        ghost1.cruise();
                    }
                }
                if(this.shapman.state === ShapmanState.Strong && [GhostState.Hunting, GhostState.Cruising].includes(ghost.state)) {
                    ghost.eaten();
                    this.sfx.play('eat');
                    this.game.points += 50;
                    this.startText.text = `Points ${this.game.points}`;
                }
            }
        }
    }
}

function getSpriteTilePosition(sprite: Phaser.Sprite, output:Phaser.Point=null, gridsize:number=32) {
    let p = output || new Phaser.Point();
    p.x = Phaser.Math.snapToFloor(Math.floor(sprite.x), gridsize) / gridsize;
    p.y = Phaser.Math.snapToFloor(Math.floor(sprite.y), gridsize) / gridsize;
    return p;
}

function getTilePixelPosition(tilePosition: Phaser.Point, output:Phaser.Point=null, gridsize:number=32) {
    output = output || new Phaser.Point();
    output.x = (tilePosition.x * gridsize) + (gridsize / 2);
    output.y = (tilePosition.y * gridsize) + (gridsize / 2);

    return output;
}

function isSpriteOnTile(sprite: Phaser.Sprite, tileMiddle: Phaser.Point, threshold:number=3) {
    var cx = Math.floor(sprite.x);
    var cy = Math.floor(sprite.y);

    return Phaser.Math.fuzzyEqual(cx, tileMiddle.x, threshold) && Phaser.Math.fuzzyEqual(cy, tileMiddle.y, threshold);
}

class Game extends Phaser.Game {
    points: number;
    lives: number;

    constructor() {
        super(640, 480, Phaser.AUTO, 'game');
        this.state.add('GameState', GameState);
        this.state.add('GameOverState', GameOverState);
        this.state.start('GameState', true, false, 1);
        this.points = 0;
        this.lives = 5;
    }
}

class GameOverState extends Phaser.State {
    create() {
        let style = { font: "75px Thirteen Pixel Fonts Regular", fill: "white", align: "center" };
        let startText = this.game.add.text(320, 240, 'Game Over', style);
        startText.anchor.x = 0.5;
        startText.inputEnabled = true;
        startText.events.onInputDown.add(() => {
            this.game.state.start('GameState', true, false, 1);
        });
    }
}

var game = new Game();
