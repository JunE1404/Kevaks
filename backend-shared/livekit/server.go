package livekit

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

var (
	ErrNotConfigured = errors.New("livekit is not configured")
	ErrRoomNotReady  = errors.New("livekit room is not ready")

	serverMu sync.RWMutex
	server   *LK
)

type LK struct {
	URL      string
	Roomname string
	Api      *lksdk.LiveKitAPI
	Room     *livekit.Room
	ctx      context.Context
	mu       sync.Mutex
	key      string
	secret   string
	// clientURL is the address handed to browsers. It differs from URL when the
	// server-side API is reached over an internal network (e.g. a compose
	// network) while clients connect through a published port.
	clientURL string
}

// InitServer configures the process-wide LiveKit API client used to create rooms.
// clientURL may be empty, in which case it falls back to url.
func InitServer(url, clientURL, apiKey, apiSecret string) (*LK, error) {
	api, err := lksdk.NewLiveKitAPI(lksdk.WithURL(url), lksdk.WithAPIKey(apiKey, apiSecret))
	if err != nil {
		return nil, err
	}

	s := &LK{
		URL:       url,
		clientURL: clientURL,
		Api:       api,
		ctx:       context.Background(),
		key:       apiKey,
		secret:    apiSecret,
	}
	serverMu.Lock()
	server = s
	serverMu.Unlock()
	return s, nil
}

func GetServer() *LK {
	serverMu.RLock()
	defer serverMu.RUnlock()
	return server
}

// NewRoom creates a LiveKit room and returns a handle that owns it.
func NewRoom(roomname string) (*LK, error) {
	s := GetServer()
	if s == nil {
		return nil, ErrNotConfigured
	}
	if roomname == "" {
		return nil, ErrRoomNotReady
	}

	room, err := s.Api.Room().CreateRoom(s.ctx, &livekit.CreateRoomRequest{Name: roomname})
	if err != nil {
		return nil, err
	}

	return &LK{
		URL:       s.URL,
		clientURL: s.clientURL,
		Roomname:  roomname,
		Api:       s.Api,
		Room:      room,
		ctx:       s.ctx,
		key:       s.key,
		secret:    s.secret,
	}, nil
}

// ClientURL returns the room URL in the form used by LiveKit client SDKs.
func (l *LK) ClientURL() string {
	target := l.clientURL
	if target == "" {
		target = l.URL
	}

	switch {
	case strings.HasPrefix(target, "https://"):
		return "wss://" + strings.TrimPrefix(target, "https://")
	case strings.HasPrefix(target, "http://"):
		return "ws://" + strings.TrimPrefix(target, "http://")
	default:
		return target
	}
}

func (l *LK) CloseRoom() error {
	l.mu.Lock()
	roomname := l.Roomname
	if l.Room != nil {
		roomname = l.Room.GetName()
		l.Room = nil
	}
	l.mu.Unlock()

	if roomname == "" {
		return nil
	}
	_, err := l.Api.Room().DeleteRoom(context.Background(), &livekit.DeleteRoomRequest{Room: roomname})
	return err
}

func (l *LK) GetJoinToken(identity, name string) (string, error) {
	l.mu.Lock()
	room := l.Room
	l.mu.Unlock()
	if room == nil {
		return "", ErrRoomNotReady
	}

	at := auth.NewAccessToken(l.key, l.secret)
	grant := &auth.VideoGrant{
		RoomJoin: true,
		Room:     room.GetName(),
	}
	at.SetVideoGrant(grant).
		SetIdentity(identity).
		SetName(name).
		SetValidFor(time.Hour)

	return at.ToJWT()
}

func (l *LK) KickParticipant(id string) error {
	l.mu.Lock()
	room := l.Room
	l.mu.Unlock()
	if room == nil {
		return ErrRoomNotReady
	}

	roomname := room.GetName()
	participants, err := l.Api.Room().ListParticipants(l.ctx, &livekit.ListParticipantsRequest{Room: roomname})
	if err != nil {
		return err
	}

	for _, p := range participants.Participants {
		if p.Identity == id {
			_, err = l.Api.Room().RemoveParticipant(l.ctx, &livekit.RoomParticipantIdentity{
				Room:     roomname,
				Identity: id,
			})
			return err
		}
	}

	return errors.New("identity not present in room")
}
