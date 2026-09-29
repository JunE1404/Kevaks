CREATE SCHEMA IF NOT EXISTS game;

CREATE TABLE IF NOT EXISTS game.trivia_games (
    uuid UUID PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game.trivia_boards (
    uuid UUID PRIMARY KEY,
    game_uuid UUID NOT NULL REFERENCES game.trivia_games (uuid) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category_points INTEGER[] NOT NULL DEFAULT '{}',
    position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game.trivia_categories (
    uuid UUID PRIMARY KEY,
    board_uuid UUID NOT NULL REFERENCES game.trivia_boards (uuid) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game.trivia_fields (
    uuid UUID PRIMARY KEY,
    category_uuid UUID NOT NULL REFERENCES game.trivia_categories (uuid) ON DELETE CASCADE,
    type TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    special_text TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS trivia_boards_game_uuid_idx
    ON game.trivia_boards (game_uuid);

CREATE INDEX IF NOT EXISTS trivia_categories_board_uuid_idx
    ON game.trivia_categories (board_uuid);

CREATE INDEX IF NOT EXISTS trivia_fields_category_uuid_idx
    ON game.trivia_fields (category_uuid);
