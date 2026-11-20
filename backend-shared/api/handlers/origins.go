package handlers

// AllowedOrigins lists the browser origins allowed to call the API and to open
// the trivia WebSocket. Cross-origin deployments (frontend on kevaks.com, API
// on api.kevaks.com) need the frontend's own origin here, because that is what
// the browser puts in the Origin header.
var AllowedOrigins = []string{
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"https://kevaks.com",
	"https://www.kevaks.com",
	"https://api.kevaks.com",
}
