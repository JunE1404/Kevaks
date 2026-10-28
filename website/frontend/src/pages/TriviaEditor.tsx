import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLanguage } from "../contexts/languageContext";
import { emptyField, newBoard, newCategory } from "../misc/trivia";
import {
  getTriviaGame,
  saveTriviaGame,
  type TriviaBoard,
  type TriviaErrorCode,
  type TriviaField,
  type TriviaGame,
} from "../requests/trivia";

type FieldTarget = { board: number; category: number; row: number };

const AUTOSAVE_DELAY = 3000;

export function TriviaEditor() {
  const { gameId } = useParams<{ gameId: string }>();
  const { localization } = useLanguage();

  const [game, setGame] = useState<TriviaGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeBoard, setActiveBoard] = useState(0);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [target, setTarget] = useState<FieldTarget | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<TriviaErrorCode | null>(null);

  const gameRef = useRef<TriviaGame | null>(null);
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const errorMessages: Record<TriviaErrorCode, string> = {
    e30: localization.errors.e30,
    e31: localization.errors.e31,
    e32: localization.errors.e32,
    unknown: localization.errors.generic,
  };

  useEffect(() => {
    let active = true;

    async function load() {
      if (!gameId) {
        setLoadFailed(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadFailed(false);

      try {
        const loaded = await getTriviaGame(gameId);
        if (!active) return;
        gameRef.current = loaded;
        setGame(loaded);
        setActiveBoard(0);
        dirtyRef.current = false;
        setDirty(false);
        versionRef.current = 0;
      } catch {
        if (active) setLoadFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [gameId]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function applyGame(next: TriviaGame) {
    gameRef.current = next;
    setGame(next);
  }

  function scheduleAutosave() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void saveNow();
    }, AUTOSAVE_DELAY);
  }

  function updateGame(updater: (current: TriviaGame) => TriviaGame) {
    const current = gameRef.current;
    if (!current) return;

    applyGame(updater(current));
    dirtyRef.current = true;
    setDirty(true);
    setSaveError(null);
    versionRef.current += 1;
    scheduleAutosave();
  }

  async function saveNow() {
    const current = gameRef.current;
    if (!current) return;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const version = versionRef.current;
    setSaving(true);
    setSaveError(null);

    try {
      const result = await saveTriviaGame(current);
      if (!result.ok) {
        setSaveError(result.code);
        return;
      }
      if (versionRef.current === version) {
        applyGame(result.game);
        dirtyRef.current = false;
        setDirty(false);
      }
    } catch {
      setSaveError("unknown");
    } finally {
      setSaving(false);
    }
  }

  function updateBoard(boardIndex: number, updater: (board: TriviaBoard) => TriviaBoard) {
    updateGame((current) => ({
      ...current,
      Boards: current.Boards.map((board, index) =>
        index === boardIndex ? updater(board) : board,
      ),
    }));
  }

  function addBoard() {
    const index = gameRef.current?.Boards.length ?? 0;
    updateGame((current) => ({
      ...current,
      Boards: [...current.Boards, newBoard(current.Boards.length + 1)],
    }));
    setActiveBoard(index);
  }

  function addRow() {
    updateBoard(activeBoard, (board) => {
      const last = board.CategoryPoints[board.CategoryPoints.length - 1] ?? 0;
      return {
        ...board,
        CategoryPoints: [...board.CategoryPoints, last + 100],
      };
    });
  }

  function updatePoint(row: number, value: number) {
    updateBoard(activeBoard, (board) => ({
      ...board,
      CategoryPoints: board.CategoryPoints.map((point, index) =>
        index === row ? value : point,
      ),
    }));
  }

  function addCategory() {
    updateBoard(activeBoard, (board) => ({
      ...board,
      Categories: [...board.Categories, newCategory(board.Categories.length + 1)],
    }));
  }

  function updateCategoryName(categoryIndex: number, name: string) {
    updateBoard(activeBoard, (board) => ({
      ...board,
      Categories: board.Categories.map((category, index) =>
        index === categoryIndex ? { ...category, Name: name } : category,
      ),
    }));
  }

  function updateField(fieldTarget: FieldTarget, patch: Partial<TriviaField>) {
    updateGame((current) => ({
      ...current,
      Boards: current.Boards.map((board, boardIndex) => {
        if (boardIndex !== fieldTarget.board) return board;
        return {
          ...board,
          Categories: board.Categories.map((category, categoryIndex) => {
            if (categoryIndex !== fieldTarget.category) return category;
            const fields = [...category.Fields];
            while (fields.length <= fieldTarget.row) {
              fields.push(emptyField());
            }
            fields[fieldTarget.row] = { ...fields[fieldTarget.row], ...patch };
            return { ...category, Fields: fields };
          }),
        };
      }),
    }));
  }

  if (loading) {
    return (
      <div className="PageContainer EditorPage">
        <p className="Subtitle">{localization.editor.l_loading}</p>
      </div>
    );
  }

  if (loadFailed || !game || game.Boards.length === 0) {
    return (
      <div className="PageContainer EditorPage">
        <p className="FormError">{localization.editor.e_load}</p>
        <Link to="/games/trivia/create">{localization.editor.b_back}</Link>
      </div>
    );
  }

  const board = game.Boards[activeBoard] ?? game.Boards[0];
  const modalField =
    target !== null
      ? game.Boards[target.board]?.Categories[target.category]?.Fields[target.row]
      : undefined;
  const modalType = modalField?.Type ?? "normal";

  return (
    <div className="PageContainer EditorPage">
      <Link to="/games/trivia/create">{localization.editor.b_back}</Link>
      <div className="EditorHeader">
        <input
          type="text"
          className="GameTitleInput"
          aria-label={localization.editor.l_game_title}
          value={game.Title}
          onChange={(event) =>
            updateGame((current) => ({ ...current, Title: event.target.value }))
          }
        />
        <div className="EditorSave">
          <button type="button" onClick={() => void saveNow()} disabled={saving}>
            {localization.editor.b_save}
          </button>
          {saving ? (
            <span className="Subtitle">{localization.editor.l_saving}</span>
          ) : saveError ? (
            <span className="FormError">{errorMessages[saveError]}</span>
          ) : dirty ? (
            <span className="Subtitle">{localization.editor.l_dirty}</span>
          ) : (
            <span className="Subtitle">{localization.editor.l_saved}</span>
          )}
        </div>
      </div>


      <div className="BoardTabs">
        {game.Boards.map((item, index) => (
          <button
            key={item.Uid}
            type="button"
            className={`BoardTab${index === activeBoard ? " active" : ""}`}
            onClick={() => setActiveBoard(index)}
          >
            {item.Title}
          </button>
        ))}
        <button type="button" onClick={addBoard}>
          {localization.editor.b_add_board}
        </button>
      </div>

      <div className="BoardToolbar">
        <button type="button" onClick={addCategory}>
          {localization.editor.b_add_column}
        </button>
      </div>

      <div
        className="TriviaBoard"
        style={{
          gridTemplateColumns: `7rem repeat(${board.Categories.length}, minmax(7rem, 1fr))`,
        }}
      >
        <div className="TriviaCell TriviaCorner">
          {localization.editor.l_points}
        </div>

        {board.Categories.map((category, categoryIndex) => (
          <div className="TriviaCell CategoryHeader" key={category.Uid}>
            {editingCategory === category.Uid ? (
              <input
                type="text"
                value={category.Name}
                autoFocus
                onChange={(event) =>
                  updateCategoryName(categoryIndex, event.target.value)
                }
                onBlur={() => setEditingCategory(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") {
                    setEditingCategory(null);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="CategoryTitle"
                onClick={() => setEditingCategory(category.Uid)}
              >
                {category.Name}
              </button>
            )}
          </div>
        ))}

        {board.CategoryPoints.map((point, row) => (
          <Fragment key={`row-${row}`}>
            <div className="TriviaCell PointCell">
              <input
                type="number"
                className="PointInput"
                value={point}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  if (!Number.isNaN(value)) updatePoint(row, value);
                }}
              />
            </div>

            {board.Categories.map((category, categoryIndex) => {
              const field = category.Fields[row];
              const special = field?.Type === "special";
              return (
                <button
                  key={category.Uid}
                  type="button"
                  className={`TriviaCell FieldCard${special ? " special" : ""}`}
                  onClick={() =>
                    setTarget({
                      board: activeBoard,
                      category: categoryIndex,
                      row,
                    })
                  }
                >
                  {special && (
                    <span className="FieldSpecial">
                      <span className="FieldSpecialText">
                        {field?.SpecialText}
                      </span>
                      <span className="FieldStar" aria-hidden="true">
                        ★
                      </span>
                    </span>
                  )}
                  <span className="FieldText">
                    {field?.Text || localization.editor.l_empty_field}
                  </span>
                </button>
              );
            })}
          </Fragment>
        ))}

        <div className="TriviaCell PointAdd">
          <button type="button" onClick={addRow}>
            {localization.editor.b_add_row}
          </button>
        </div>
      </div>

      {target && (
        <div className="ModalOverlay" onClick={() => setTarget(null)}>
          <div className="Modal" onClick={(event) => event.stopPropagation()}>
            <label className="ModalCheck">
              <input
                type="checkbox"
                checked={modalType === "special"}
                onChange={(event) =>
                  updateField(target, {
                    Type: event.target.checked ? "special" : "normal",
                  })
                }
              />
              {localization.editor.l_field_special}
            </label>

            {modalType === "special" && (
              <label className="ModalLabel">
                {localization.editor.l_special_name}
                <input
                  type="text"
                  value={modalField?.SpecialText ?? ""}
                  onChange={(event) =>
                    updateField(target, { SpecialText: event.target.value })
                  }
                />
              </label>
            )}

            <label className="ModalLabel">
              {localization.editor.l_question}
              <textarea
                value={modalField?.Text ?? ""}
                onChange={(event) =>
                  updateField(target, { Text: event.target.value })
                }
              />
            </label>

            <label className="ModalLabel">
              {localization.editor.l_answer}
              <input
                type="text"
                value={modalField?.Answer ?? ""}
                onChange={(event) =>
                  updateField(target, { Answer: event.target.value })
                }
              />
            </label>

            <button type="button" onClick={() => setTarget(null)}>
              {localization.editor.b_close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
