package trivia

import "github.com/google/uuid"

type TriviaGame struct {
	Uid    uuid.UUID
	Owner  uuid.UUID
	Title  string
	Done   bool
	Boards []Board
}
type Board struct {
	Uid            uuid.UUID
	Title          string
	CategoryPoints []int
	Categories     []Category
}

type Category struct {
	Uid    uuid.UUID
	Name   string
	Fields []Field
}

type Field struct {
	Uid         uuid.UUID
	Type        string
	Text        string
	SpecialText string
}
