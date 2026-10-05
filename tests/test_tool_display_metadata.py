"""Display-only data on tool rows: what a client draws but the model never reads.

Behavior contracts — a ``write_file`` diff survives a reload, sits beside the
row's other display data, and never reaches an API copy of the transcript.
"""

import json

import pytest

from work4you_state import SessionDB


@pytest.fixture
def db(tmp_path, monkeypatch):
    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path))
    return SessionDB(db_path=tmp_path / "state.db")


def _tool_turn(db: SessionDB, session_key: str, call_id: str) -> None:
    db.append_message(session_key, "user", "write the summary")
    db.append_message(
        session_key,
        "assistant",
        "",
        tool_calls=[
            {
                "id": call_id,
                "type": "function",
                "function": {
                    "name": "write_file",
                    "arguments": json.dumps({"path": "resumo.md"}),
                },
            }
        ],
    )
    db.append_message(
        session_key,
        "tool",
        json.dumps({"bytes_written": 9}),
        tool_name="write_file",
        tool_call_id=call_id,
    )


def _tool_row(db: SessionDB, session_key: str, call_id: str) -> dict:
    return next(
        m
        for m in db.get_messages(session_key)
        if m.get("role") == "tool" and m.get("tool_call_id") == call_id
    )


def _metadata(row: dict) -> dict:
    raw = row.get("display_metadata")
    return json.loads(raw) if isinstance(raw, str) else (raw or {})


def test_merges_into_the_tool_row_of_that_call(db):
    key = db.create_session("tool-meta", "test")
    _tool_turn(db, key, "call-1")

    assert (
        db.merge_tool_display_metadata(key, "call-1", {"inline_diff": "+# Resumo"})
        is True
    )
    assert _metadata(_tool_row(db, key, "call-1")) == {"inline_diff": "+# Resumo"}


def test_keeps_what_the_row_already_carried(db):
    key = db.create_session("tool-meta", "test")
    _tool_turn(db, key, "call-1")
    row_id = [
        m["_row_id"] for m in db.get_messages_as_conversation(key, include_row_ids=True)
    ][-1]
    db.set_message_reaction(key, row_id, "\U0001f44d", author="user")

    db.merge_tool_display_metadata(key, "call-1", {"inline_diff": "+line"})
    meta = _metadata(_tool_row(db, key, "call-1"))

    assert meta["inline_diff"] == "+line"
    assert [r["emoji"] for r in meta[SessionDB.REACTIONS_METADATA_KEY]] == [
        "\U0001f44d"
    ]


def test_reports_a_call_it_cannot_find(db):
    key = db.create_session("tool-meta", "test")
    other = db.create_session("tool-meta-other", "test")
    _tool_turn(db, other, "call-1")

    assert db.merge_tool_display_metadata(key, "call-1", {"inline_diff": "+x"}) is False
    assert db.merge_tool_display_metadata(key, "", {"inline_diff": "+x"}) is False
    assert _metadata(_tool_row(db, other, "call-1")) == {}


def test_leaves_what_the_model_reads_untouched(db):
    """Replayed history keeps the tool result byte for byte; the diff rides only
    in ``display_metadata``, which the request builder strips from every API
    copy (see tests/run_agent/test_session_meta_filtering.py)."""
    key = db.create_session("tool-meta", "test")
    _tool_turn(db, key, "call-1")
    before = [dict(m) for m in db.get_messages_as_conversation(key)]

    db.merge_tool_display_metadata(key, "call-1", {"inline_diff": "+# Resumo"})
    after = [dict(m) for m in db.get_messages_as_conversation(key)]

    strip = lambda rows: [
        {k: v for k, v in m.items() if k != "display_metadata"} for m in rows
    ]  # noqa: E731
    assert strip(after) == strip(before)
