        <div
          v-for="category in categories"
          :key="category.id"
          class="category-timeline-item"
          @click="toggleCategory(category.id)"
        >
          <div class="category-header">
            <h4>{{ category.name.replace('\\n', ' ') }}</h4>
            <div class="category-info">
              <p class="category-poolname">{{ getPoolNameForCategory(category.id) }}</p>
              <p class="category-draw-count">{{ getCategoryDrawCount(category.id) }} 抽</p>
            </div>
            <div class="toggle-icon">
              {{ expandedCategories[category.id] ? '▲' : '▼' }}
            </div>
          </div>
          
          <!-- 展开的高星级角色列表 -->
          <div v-if="expandedCategories[category.id]" class="category-details">
            <div 
              v-for="(record, index) in getHighRarityRecordsForCategory(category.id)" 
              :key="index"
              class="high-rarity-item"
            >
              <div class="operator-avatar">
                <img
                  :src="getOperatorAvatarUrl(record.charId)"
                  :alt="record.charName"
                  class="avatar-img"
                  @error="handleAvatarError"
                />
              </div>
              <div class="operator-info">
                <h4>{{ record.charName }}</h4>
                <p class="rarity-text">{{ getRarityText(record.rarity) }}</p>
              </div>
              <div class="gacha-progress">
                <div class="progress-bar">
                  <div 
                    class="progress-fill" 
                    :style="{ width: getProgressWidth(record.drawCount) + '%' }"
                  ></div>
                </div>
                <p class="draw-count">{{ record.drawCount }} 抽</p>
              </div>
            </div>
          </div>
        </div>