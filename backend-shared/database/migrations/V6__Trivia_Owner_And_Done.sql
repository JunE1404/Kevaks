ALTER TABLE game.trivia_games
    ADD COLUMN owner UUID NOT NULL REFERENCES account.users (uuid) ON DELETE CASCADE,
    ADD COLUMN done BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS trivia_games_owner_idx
    ON game.trivia_games (owner);

ALTER TABLE game.trivia_fields
    ADD CONSTRAINT trivia_fields_type_check
        CHECK (type IN ('normal', 'special'));

ALTER TABLE game.trivia_fields
    ADD CONSTRAINT trivia_fields_special_text_check
        CHECK (type <> 'special' OR special_text <> '');
