# Audio Drop Folder

Drop your `.m4a` files into these folders:

- `public/audio/sfx/`
- `public/audio/voice-memos/`

Current expected filenames (optional placeholders):

## SFX

- `jump.m4a`
- `respawn.m4a`

## Voice Memos

Create one folder per player in `voice-memos`, for example:

- `public/audio/voice-memos/p1/`
- `public/audio/voice-memos/p2/`

Then add these files inside each player folder:

- `hit.m4a` (plays when that player gets hit)
- `ko.m4a` (plays when that player gets KO'd)
- `win.m4a` (plays when that player KOs the other player)

You can replace these files at any time while keeping the same names.
