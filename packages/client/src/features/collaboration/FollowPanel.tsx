import { usePresenceStore } from '../../store/presenceStore.js'
import { useUiStore } from '../../store/uiStore.js'

export function FollowPanel() {
  const remoteUsers = usePresenceStore((s) => s.remoteUsers)
  const followingUserId = useUiStore((s) => s.followingUserId)
  const setFollowing = useUiStore((s) => s.setFollowing)

  const users = Object.values(remoteUsers)
  if (users.length === 0) return null

  const followedUser = followingUserId ? remoteUsers[followingUserId] : null

  return (
    <>
      {/* Follow banner — shown when actively following someone */}
      {followedUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 32,
            background: followedUser.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            fontSize: 13,
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 600,
            zIndex: 9998,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <span>Following {followedUser.name ?? followedUser.userId.slice(-6)}</span>
          <button
            onClick={() => setFollowing(null)}
            style={{
              background: 'rgba(255,255,255,0.25)',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              padding: '2px 8px',
            }}
          >
            Stop
          </button>
        </div>
      )}

      {/* People panel — fixed bottom-left, shows connected users */}
      <div
        style={{
          position: 'fixed',
          bottom: 12,
          left: 12,
          background: 'rgba(255,255,255,0.96)',
          borderRadius: 8,
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          padding: '8px 10px',
          zIndex: 9997,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minWidth: 160,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
        }}
      >
        <div style={{ color: '#94a3b8', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', paddingBottom: 2 }}>
          PEOPLE ({users.length})
        </div>
        {users.map((user) => {
          const isFollowing = followingUserId === user.userId
          return (
            <div
              key={user.userId}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: user.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  color: '#334155',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.name ?? user.userId.slice(-6)}
              </span>
              <button
                onClick={() => setFollowing(isFollowing ? null : user.userId)}
                style={{
                  background: isFollowing ? user.color : '#f1f5f9',
                  border: 'none',
                  borderRadius: 4,
                  color: isFollowing ? '#fff' : '#64748b',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 7px',
                  flexShrink: 0,
                  transition: 'all 0.1s',
                }}
              >
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
